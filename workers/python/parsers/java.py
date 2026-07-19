"""
parsers/java.py — Parser AST detallado para archivos Java.

Usa tree-sitter para extraer imports, clases/interfaces/records/enums,
métodos, constructores, atributos y calcular métricas locales.
"""

from __future__ import annotations

import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity, JAVA_COMPLEXITY_CONFIG
from metrics.cohesion import calculate_class_metrics


# ── Extracción de Imports ──

def _extract_imports(root, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae todos los imports de un archivo Java.
    Identifica imports simples, wildcards y estáticos.
    """
    imports: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "import_declaration":
            is_static = False
            is_wildcard = False
            module_name = ""

            # Verificar si es estático (si tiene un hijo token 'static')
            for sub in child.children:
                if sub.type == "static":
                    is_static = True
                elif sub.type == "scoped_identifier":
                    module_name = _node_text(sub, source)
                elif sub.type == "asterisk":
                    is_wildcard = True

            if module_name:
                imports.append({
                    "module": module_name,
                    "isStatic": is_static,
                    "isWildcard": is_wildcard,
                    "isRelative": False,
                })

    return imports


def _node_text(node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _child_by_type(node, type_name: str) -> Any | None:
    for child in node.children:
        if child.type == type_name:
            return child
    return None


# ── Extracción de Parámetros ──

def _extract_parameters(params_node, source: bytes) -> list[dict[str, Any]]:
    """Extrae la lista de parámetros de un formal_parameters de Java."""
    params: list[dict[str, Any]] = []
    if params_node is None:
        return params

    for child in params_node.children:
        if child.type in ("(", ")", ","):
            continue

        param: dict[str, Any] = {
            "name": "",
            "type": "any",
            "isOptional": False,
            "isVariadic": False,
        }

        if child.type == "formal_parameter":
            type_n = child.child_by_field_name("type")
            # El nombre está en el child 'name' o dentro de variable_declarator
            name_n = child.child_by_field_name("name")
            if name_n is None:
                # Fallback: a veces es variable_declarator
                for sub in child.children:
                    if sub.type == "variable_declarator":
                        name_n = sub.child_by_field_name("name")

            if name_n:
                param["name"] = _node_text(name_n, source)
            if type_n:
                param["type"] = _node_text(type_n, source)

        elif child.type == "spread_parameter":
            # Parámetro variádico (ej: String... elements)
            # La estructura es: type '...' variable_declarator
            type_n = None
            name_n = None
            for sub in child.children:
                if sub.type in ("type_identifier", "integral_type", "generic_type"):
                    type_n = sub
                elif sub.type == "variable_declarator":
                    name_n = sub.child_by_field_name("name")

            if name_n:
                param["name"] = _node_text(name_n, source)
            if type_n:
                param["type"] = _node_text(type_n, source)
            param["isVariadic"] = True

        if param["name"]:
            params.append(param)

    return params


# ── Extractor de Atributos de Instancia Java para LCOM4 ──

def make_java_attribute_extractor(field_names: set[str]) -> Any:
    """
    Construye una función para extraer atributos de instancia accedidos
    dentro del método, usando el conjunto de campos conocidos de la clase
    para evitar falsos positivos con variables locales o estáticas.
    """
    def extract_java_attributes(body_node) -> set[str]:
        attrs: set[str] = set()

        def _visit(node):
            if node.type == "field_access":
                # Caso: this.x o Outer.this.x
                obj = node.child_by_field_name("object")
                field = node.child_by_field_name("field")
                if obj and field:
                    # Si el objeto es 'this' o termina en '.this'
                    obj_text = obj.text
                    if obj_text == b"this" or obj_text.endswith(b".this"):
                        attrs.add(field.text.decode("utf-8", errors="replace"))
            elif node.type == "identifier":
                # Caso: acceso implícito a campo de clase sin 'this.'
                # Solo se cuenta si coincide con algún campo declarado en la clase
                name = node.text.decode("utf-8", errors="replace")
                if name in field_names:
                    # Asegurar que no sea una declaración de variable local
                    # ni parte de un field_access que no sea de this.
                    parent = node.parent
                    if parent is not None:
                        if parent.type == "variable_declarator" and parent.child_by_field_name("name") == node:
                            pass
                        elif parent.type == "formal_parameter" and parent.child_by_field_name("name") == node:
                            pass
                        elif parent.type == "field_access" and parent.child_by_field_name("field") == node:
                            # Ya manejado por el caso field_access principal
                            pass
                        else:
                            attrs.add(name)
                    else:
                        attrs.add(name)

            for child in node.children:
                _visit(child)

        _visit(body_node)
        return attrs

    return extract_java_attributes


# ── Extracción de Clases y Estructuras OOP ──

def _extract_classes_and_structures(
    root, source: bytes, module_id: str
) -> list[dict[str, Any]]:
    """
    Extrae clases, interfaces, enums y records del archivo Java,
    incluyendo clases internas/anidadas recursivamente.
    """
    classes: list[dict[str, Any]] = []

    def _traverse(node, parent_class_name: str | None = None):
        # Tipos válidos de estructuras OOP en Java
        is_class = node.type == "class_declaration"
        is_interface = node.type == "interface_declaration"
        is_enum = node.type == "enum_declaration"
        is_record = node.type == "record_declaration"

        if is_class or is_interface or is_enum or is_record:
            name_node = node.child_by_field_name("name")
            raw_name = _node_text(name_node, source) if name_node else "Anonymous"

            # Nombre calificado para clases internas (ej: Outer.Inner)
            name = f"{parent_class_name}.{raw_name}" if parent_class_name else raw_name

            # Modificadores, Visibilidad y Decoradores (Anotaciones)
            mods_node = _child_by_type(node, "modifiers")
            visibility, is_static, is_abstract, decorators = _parse_modifiers(mods_node, source)

            if is_interface:
                is_abstract = True

            # Herencia y Extensiones
            extends: list[str] = []
            if is_class:
                super_node = node.child_by_field_name("superclass")
                if super_node:
                    # extends Shape
                    for sub in super_node.children:
                        if sub.type in ("type_identifier", "generic_type"):
                            extends.append(_node_text(sub, source))

            # Interfaces implementadas (implements) o extendidas en interfaces
            implements: list[str] = []
            interfaces_node = node.child_by_field_name("interfaces")
            if interfaces_node:
                # Puede ser super_interfaces o extends_interfaces
                for sub in interfaces_node.children:
                    if sub.type == "type_list":
                        for type_n in sub.children:
                            if type_n.type in ("type_identifier", "generic_type"):
                                implements.append(_node_text(type_n, source))

            # Procesar el cuerpo de la clase
            body_node = node.child_by_field_name("body")
            methods, method_bodies, attributes = _extract_members(
                body_node, source, module_id, name, is_interface
            )

            # LCOM4 y Cohesión generalizada con el extractor de atributos Java.
            # El constructor se excluye por nombre real de clase (no "__init__")
            # para evitar el "efecto puente" documentado en cohesion.py. El
            # filtro de tipos primitivos para CBO vive dentro de
            # calculate_class_metrics (set fijo str/int/float/bool/...), por lo
            # que boolean/int/long de Java pasan por ese mismo set base — ver
            # nota en csharp.py sobre limitación equivalente para C#.
            field_names = {attr["name"] for attr in attributes}
            extract_attrs_fn = make_java_attribute_extractor(field_names)
            metrics = calculate_class_metrics(
                methods,
                method_bodies,
                attributes,
                attribute_extractor=extract_attrs_fn,
                constructor_names=frozenset({name.split(".")[-1]}),
            )

            classes.append({
                "id": f"{module_id}::{name}",
                "name": name,
                "isAbstract": is_abstract,
                "isInterface": is_interface,
                "visibility": visibility,
                "methods": methods,
                "attributes": attributes,
                "extends": extends,
                "implements": implements,
                "decorators": decorators,
                "metrics": metrics,
            })

            # Buscar clases internas recursivamente en el cuerpo de esta clase
            if body_node:
                for child in body_node.children:
                    _traverse(child, name)
        else:
            # Continuar buscando clases/interfaces en los hijos
            for child in node.children:
                _traverse(child, parent_class_name)

    _traverse(root)
    return classes


def _parse_modifiers(
    mods_node, source: bytes
) -> tuple[str, bool, bool, list[str]]:
    """Parsea el nodo 'modifiers' de Java para extraer visibilidad y anotaciones."""
    visibility = "package"
    is_static = False
    is_abstract = False
    decorators: list[str] = []

    if mods_node is None:
        return visibility, is_static, is_abstract, decorators

    for child in mods_node.children:
        if child.type == "public":
            visibility = "public"
        elif child.type == "private":
            visibility = "private"
        elif child.type == "protected":
            visibility = "protected"
        elif child.type == "static":
            is_static = True
        elif child.type == "abstract":
            is_abstract = True
        elif child.type in ("marker_annotation", "annotation"):
            # Anotaciones de Java actúan como decoradores
            name_node = child.child_by_field_name("name")
            if name_node:
                decorators.append(_node_text(name_node, source))

    return visibility, is_static, is_abstract, decorators


def _extract_members(
    body_node, source: bytes, module_id: str, class_name: str, is_interface: bool
) -> tuple[list[dict], list, list[dict]]:
    """Extrae métodos, constructores y atributos de un cuerpo de clase o interfaz."""
    methods: list[dict[str, Any]] = []
    method_bodies: list = []
    attributes: list[dict[str, Any]] = []

    if body_node is None:
        return methods, method_bodies, attributes

    for child in body_node.children:
        # 1. Métodos y Constructores
        is_method = child.type == "method_declaration"
        is_constructor = child.type == "constructor_declaration"

        if is_method or is_constructor:
            name_node = child.child_by_field_name("name")
            name = _node_text(name_node, source) if name_node else "anonymous"

            params_node = child.child_by_field_name("parameters")
            params = _extract_parameters(params_node, source)

            ret_type = "void"
            if is_method:
                type_node = child.child_by_field_name("type")
                if type_node:
                    ret_type = _node_text(type_node, source)
            else:
                ret_type = class_name.split(".")[-1]  # Nombre de la clase constructora

            mods_node = _child_by_type(child, "modifiers")
            visibility, is_static, is_abstract, decorators = _parse_modifiers(mods_node, source)

            if is_interface and not is_abstract:
                # En interfaces, si no tiene la keyword 'default', es abstracto
                is_abstract = True
                if mods_node:
                    for sub in mods_node.children:
                        if sub.type == "default":
                            is_abstract = False

            body = child.child_by_field_name("body")
            cc = cyclomatic_complexity(body, JAVA_COMPLEXITY_CONFIG) if body else 1
            cog = cognitive_complexity(body, JAVA_COMPLEXITY_CONFIG) if body else 0
            loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

            methods.append({
                "name": name,
                "visibility": visibility,
                "isStatic": is_static,
                "isAbstract": is_abstract,
                "isAsync": False,  # Java no tiene async nativo a nivel de firma como JS/Python
                "isConstructor": is_constructor,  # FIX: bandera explícita, ya que en Java
                                                   # el constructor se llama como la clase,
                                                   # no "__init__" ni "constructor".
                "parameters": params,
                "returnType": ret_type,
                "cyclomaticComplexity": cc,
                "cognitiveComplexity": cog,
                "loc": loc,
                "decorators": decorators,
            })
            method_bodies.append(body)

        # 2. Atributos (Field declarations)
        elif child.type == "field_declaration":
            type_node = child.child_by_field_name("type")
            t_str = _node_text(type_node, source) if type_node else "any"

            mods_node = _child_by_type(child, "modifiers")
            visibility, is_static, _, _ = _parse_modifiers(mods_node, source)

            # Un field_declaration puede declarar varios atributos separados por comas: int x, y;
            for sub in child.children:
                if sub.type == "variable_declarator":
                    name_node = sub.child_by_field_name("name")
                    if name_node:
                        attributes.append({
                            "name": _node_text(name_node, source),
                            "type": t_str,
                            "visibility": visibility,
                            "isStatic": is_static,
                            "isReadonly": False,
                        })

    return methods, method_bodies, attributes


# ── Detección de Llamadas HTTP Externas ──

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas (HttpClient de Java 11+, RestTemplate, WebClient)."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "method_invocation":
            name_node = node.child_by_field_name("name")
            if name_node:
                name_str = _node_text(name_node, source)
                # Detección heurística de llamadas comunes en Java
                if name_str in ("send", "sendAsync", "exchange", "getForObject", "postForObject"):
                    obj_node = node.child_by_field_name("object")
                    obj_str = _node_text(obj_node, source) if obj_node else ""

                    calls.append({
                        "moduleId": module_id,
                        "externalSystemId": "http-api",
                        "protocol": "http",
                        "description": f"{obj_str}.{name_str}(...)" if obj_str else f"{name_str}(...)",
                    })
        for child in node.children:
            _visit(child)

    _visit(root)
    return calls


def _count_logical_lines(source: bytes) -> int:
    """LLOC: cuenta líneas reales de código, omitiendo comentarios y líneas vacías."""
    lloc = 0
    in_block_comment = False
    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        text = line.decode("utf-8", errors="replace")
        if in_block_comment:
            if "*/" in text:
                in_block_comment = False
            continue
        if text.startswith("/*"):
            if "*/" not in text:
                in_block_comment = True
            continue
        if text.startswith("//"):
            continue
        lloc += 1
    return lloc


# ── Función Principal de Parseo Java ──

def parse_java_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Java, extrayendo clases, métodos,
    imports, llamadas externas y calculando sus métricas.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    # Extraer estructura
    imports_data = _extract_imports(root, source)
    classes = _extract_classes_and_structures(root, source, module_id)
    external_calls = _detect_external_calls(root, source, module_id)

    # Identificar IDs de módulos importados
    import_ids: list[str] = [imp["module"] for imp in imports_data]

    # LOC y LLOC
    loc = len(source.splitlines())
    lloc = _count_logical_lines(source)

    # Métricas del módulo
    all_cc = [
        m["cyclomaticComplexity"]
        for c in classes
        for m in c.get("methods", [])
    ]
    cc_avg = sum(all_cc) / len(all_cc) if all_cc else 1.0
    cc_max = max(all_cc) if all_cc else 1

    total_classes = len(classes)
    abstract_classes = sum(1 for c in classes if c.get("isAbstract", False))
    abstractness = abstract_classes / total_classes if total_classes > 0 else 0.0

    ce = len(set(import_ids))

    # Maintainability Index
    lloc_safe = max(lloc, 1)
    loc_safe = max(loc, 1)
    import math
    raw_mi = 171 - 5.2 * math.log(lloc_safe) - 0.23 * cc_avg - 16.2 * math.log(loc_safe)
    mi = max(0.0, min(100.0, (raw_mi * 100) / 171))

    return {
        "module": {
            "id": module_id,
            "type": "module",
            "name": module_name,
            "moduleType": "unknown",  # Resuelto por patrones después
            "language": "java",
            "loc": loc,
            "lloc": lloc,
            "classes": classes,
            "functions": [],  # Java no tiene funciones globales de primer nivel
            "imports": list(set(import_ids)),
            "importedBy": [],
            "stableSince": "",
            "lastSeenIn": "",
            "metrics": {
                "ce": ce,
                "abstractness": round(abstractness, 4),
                "lcom4": 1,
                "maintainabilityIndex": round(mi, 2),
                "cyclomaticComplexityAvg": round(cc_avg, 2),
                "cyclomaticComplexityMax": cc_max,
                "connascence": None,
                "quantumId": None,
            },
        },
        "dependencies": [
            {"source": module_id, "target": imp, "kind": "import", "weight": 1}
            for imp in set(import_ids)
        ],
        "invocations": [],
        "externalCalls": external_calls,
        "rawImports": imports_data,
    }