"""
parsers/python.py — Parser AST detallado para archivos Python.

Usa tree-sitter para extraer imports, clases, funciones/métodos, atributos
y llamadas HTTP, produciendo un resultado compatible con WorkerAnalysisResult.

Estructura real del AST verificada contra tree-sitter-python v0.23+:
  - Clases/funciones decoradas están envueltas en `decorated_definition`.
  - Parámetros tienen 6 formas distintas (identifier, typed_parameter, etc.).
  - Superclases usan `argument_list` que puede incluir `keyword_argument`
    (ej: metaclass=) que deben filtrarse de la herencia.
  - Imports relativos usan `relative_import` con `import_prefix`.

Referencia: §4.2 de la especificación técnica SAAC.
"""

from __future__ import annotations

import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity
from metrics.cohesion import calculate_class_metrics, extract_self_attributes, PYTHON_PRIMITIVES


# ── Extracción de Imports ──

def _extract_imports(root, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae todos los imports del módulo, recorriendo el AST manualmente
    (más robusto que queries declarativas para cubrir todas las variantes).
    """
    imports: list[dict[str, Any]] = []

    for child in root.children:
        node = child
        # Desenvolver decorated_definition (raro en imports, pero posible)
        if node.type == "decorated_definition":
            defn = node.child_by_field_name("definition")
            if defn:
                node = defn

        if node.type == "import_statement":
            _extract_import_statement(node, imports, source)
        elif node.type == "import_from_statement":
            _extract_import_from_statement(node, imports, source)

    return imports


def _node_text(node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _extract_import_statement(node, imports: list, source: bytes):
    """Procesa `import X`, `import X as Y`, `import X, Y`."""
    for child in node.children:
        if child.type == "dotted_name":
            imports.append({
                "module": _node_text(child, source),
                "names": [],
                "isRelative": False,
            })
        elif child.type == "aliased_import":
            name_node = child.child_by_field_name("name")
            alias_node = child.child_by_field_name("alias")
            if name_node:
                imports.append({
                    "module": _node_text(name_node, source),
                    "names": [],
                    "alias": _node_text(alias_node, source) if alias_node else None,
                    "isRelative": False,
                })


def _extract_import_from_statement(node, imports: list, source: bytes):
    """
    Procesa `from X import Y`, `from X import Y as Z`, `from X import *`,
    `from . import X`, `from ..pkg import X`.
    """
    module_node = node.child_by_field_name("module_name")
    is_relative = False
    module_name = ""
    relative_prefix = ""

    if module_node:
        if module_node.type == "dotted_name":
            module_name = _node_text(module_node, source)
        elif module_node.type == "relative_import":
            is_relative = True
            # Extraer el prefix (., .., ...) y el nombre del paquete si existe
            for sub in module_node.children:
                if sub.type == "import_prefix":
                    relative_prefix = _node_text(sub, source)
                elif sub.type == "dotted_name":
                    module_name = _node_text(sub, source)
            if not module_name:
                module_name = relative_prefix
            else:
                module_name = relative_prefix + module_name

    # Recoger los nombres importados (pueden ser múltiples hermanos `name:`)
    imported_names: list[dict[str, str | None]] = []
    is_wildcard = False

    for child in node.children:
        if child.type == "dotted_name" and child != module_node:
            imported_names.append({
                "name": _node_text(child, source),
                "alias": None,
            })
        elif child.type == "aliased_import":
            name_n = child.child_by_field_name("name")
            alias_n = child.child_by_field_name("alias")
            if name_n:
                imported_names.append({
                    "name": _node_text(name_n, source),
                    "alias": _node_text(alias_n, source) if alias_n else None,
                })
        elif child.type == "wildcard_import":
            is_wildcard = True

    imports.append({
        "module": module_name,
        "names": imported_names,
        "isRelative": is_relative,
        "isWildcard": is_wildcard,
    })


# ── Extracción de Parámetros ──

def _extract_parameters(params_node, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae parámetros de un nodo `(parameters)`, distinguiendo las 6 formas
    válidas: identifier, typed_parameter, default_parameter,
    typed_default_parameter, list_splat_pattern, dictionary_splat_pattern.
    """
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

        if child.type == "identifier":
            param["name"] = _node_text(child, source)

        elif child.type == "typed_parameter":
            name_n = child.child_by_field_name("name") or _first_child_of_type(child, "identifier")
            type_n = child.child_by_field_name("type")
            if name_n:
                param["name"] = _node_text(name_n, source)
            if type_n:
                param["type"] = _node_text(type_n, source)

        elif child.type == "default_parameter":
            name_n = child.child_by_field_name("name")
            if name_n:
                param["name"] = _node_text(name_n, source)
            param["isOptional"] = True

        elif child.type == "typed_default_parameter":
            name_n = child.child_by_field_name("name")
            type_n = child.child_by_field_name("type")
            if name_n:
                param["name"] = _node_text(name_n, source)
            if type_n:
                param["type"] = _node_text(type_n, source)
            param["isOptional"] = True

        elif child.type == "list_splat_pattern":
            inner = _first_child_of_type(child, "identifier")
            if inner:
                param["name"] = _node_text(inner, source)
            param["isVariadic"] = True

        elif child.type == "dictionary_splat_pattern":
            inner = _first_child_of_type(child, "identifier")
            if inner:
                param["name"] = _node_text(inner, source)
            param["isVariadic"] = True

        else:
            # Tipo desconocido: skip silenciosamente
            continue

        if param["name"]:
            params.append(param)

    return params


def _extract_self_attribute_types(method_body_node, source: bytes) -> dict[str, str]:
    """
    Recorre el cuerpo de un método buscando asignaciones ANOTADAS a
    atributos de instancia (`self.x: Tipo = valor`), y devuelve un dict
    {nombre_atributo: tipo_como_texto}.

    Complementa a `extract_self_attributes` (metrics/cohesion.py), que solo
    devuelve NOMBRES de atributos (para el cálculo de LCOM4, donde el tipo
    es irrelevante). Antes de esta función, `_extract_class_members` poblaba
    SIEMPRE `AttributeInfo.type` como el literal `"any"`, incluso cuando el
    código tenía una anotación de tipo explícita — perdiendo esa
    información para cualquier consumidor que sí la necesite (ej. el ER
    Diagram de `supplementary_diagrams.rs` en el backend Rust, que detecta
    relaciones entre entidades comparando el tipo de un atributo contra
    nombres de clase conocidos).

    Solo se capturan atributos con anotación EXPLÍCITA (`self.x: Tipo = v`).
    Asignaciones simples (`self.x = v`, sin anotación) simplemente no
    aparecen en el dict devuelto — el caller conserva el fallback `"any"`
    para esos casos, ya que no hay tipo real que extraer del AST.

    En la gramática tree-sitter-python, una asignación anotada es un nodo
    `assignment` con TRES campos con nombre: `left` (el target, aquí un
    `attribute` con objeto `self`), `type` (el nodo de la anotación de
    tipo, presente SOLO si hay anotación), y `right` (el valor asignado).
    Una asignación simple (`self.x = v`) es el mismo tipo de nodo `assignment`
    pero SIN el campo `type` (`child_by_field_name("type")` da `None`).

    Args:
        method_body_node: Nodo tree-sitter del cuerpo (block) del método.
        source: Bytes del código fuente completo, para decodificar el texto
            de los nodos de tipo (que pueden ser genéricos multi-token
            como `list[OrderItem]`, no solo un `identifier` simple).

    Returns:
        Dict con los atributos que tienen anotación explícita de tipo.
    """
    types: dict[str, str] = {}
    if method_body_node is None:
        return types

    def _visit(node):
        if node.type == "assignment":
            left = node.child_by_field_name("left")
            type_node = node.child_by_field_name("type")

            if (
                left is not None
                and type_node is not None
                and left.type == "attribute"
            ):
                left_children = left.children
                # Estructura de `attribute`: object '.' attribute_name.
                # Solo nos interesan los atributos de `self` (instancia),
                # igual que el criterio de `extract_self_attributes`.
                if (
                    len(left_children) >= 3
                    and left_children[0].type == "identifier"
                    and left_children[0].text == b"self"
                    and left_children[2].type == "identifier"
                ):
                    attr_name = left_children[2].text.decode("utf-8")
                    type_text = source[type_node.start_byte:type_node.end_byte].decode(
                        "utf-8", errors="replace"
                    )
                    # Si el mismo atributo se anota más de una vez en el
                    # método (raro, pero posible con reasignaciones), se
                    # conserva la PRIMERA anotación encontrada.
                    types.setdefault(attr_name, type_text)

        for child in node.children:
            _visit(child)

    _visit(method_body_node)
    return types


def _first_child_of_type(node, type_name: str):
    for child in node.children:
        if child.type == type_name:
            return child
    return None


# ── Extracción de Clases ──

def _extract_classes(root, source: bytes, module_id: str) -> tuple[list[dict], list[list]]:
    """
    Extrae clases del módulo, incluidas las envueltas en `decorated_definition`.

    Returns:
        (classes, method_body_nodes_per_class)
        - classes: lista de ClassInfo dicts.
        - method_body_nodes_per_class: lista paralela, donde cada elemento
          es la lista de nodos `block` de los métodos de esa clase.
    """
    classes: list[dict[str, Any]] = []
    all_method_bodies: list[list] = []

    for child in root.children:
        class_node = None
        decorators: list[str] = []

        if child.type == "class_definition":
            class_node = child
        elif child.type == "decorated_definition":
            defn = child.child_by_field_name("definition")
            if defn and defn.type == "class_definition":
                class_node = defn
                decorators = _extract_decorators(child, source)

        if class_node is None:
            continue

        name_node = class_node.child_by_field_name("name")
        name = _node_text(name_node, source) if name_node else "AnonymousClass"

        # Superclases: filtrar keyword_argument (ej: metaclass=Meta)
        supers_node = class_node.child_by_field_name("superclasses")
        extends: list[str] = []
        if supers_node:
            for sc in supers_node.children:
                if sc.type in ("(", ")", ","):
                    continue
                if sc.type == "keyword_argument":
                    continue  # metaclass=Meta, etc.
                if sc.type in ("identifier", "attribute"):
                    extends.append(_node_text(sc, source))

        # Extraer métodos y atributos del body de la clase
        body_node = class_node.child_by_field_name("body")
        methods, method_bodies, attributes = _extract_class_members(
            body_node, source, module_id, name
        )

        # Calcular métricas de clase (primitive_types explícito por
        # consistencia con java.py, aunque coincide con el default)
        metrics = calculate_class_metrics(
            methods, method_bodies, attributes, primitive_types=PYTHON_PRIMITIVES
        )

        is_abstract = any(
            m.get("isAbstract", False) for m in methods
        ) or "ABC" in extends or "ABCMeta" in extends

        classes.append({
            "id": f"{module_id}::{name}",
            "name": name,
            "isAbstract": is_abstract,
            "isInterface": False,  # Python no tiene interfaces nativas
            "visibility": "public",  # Python no tiene visibility modifiers
            "methods": methods,
            "attributes": attributes,
            "extends": extends,
            "implements": [],
            "decorators": decorators,
            "metrics": metrics,
        })
        all_method_bodies.append(method_bodies)

    return classes, all_method_bodies


def _extract_decorators(decorated_node, source: bytes) -> list[str]:
    """Extrae los nombres de los decoradores de un `decorated_definition`."""
    decorators: list[str] = []
    for child in decorated_node.children:
        if child.type == "decorator":
            # El contenido del decorador puede ser un identifier, call, o attribute
            text = _node_text(child, source).lstrip("@").strip()
            decorators.append(text)
    return decorators


def _extract_class_members(
    body_node, source: bytes, module_id: str, class_name: str
) -> tuple[list[dict], list, list[dict]]:
    """
    Extrae métodos (funciones dentro de la clase) y atributos (asignaciones
    a self.x, especialmente en __init__) del cuerpo de una clase.
    """
    methods: list[dict[str, Any]] = []
    method_bodies: list = []
    attributes: list[dict[str, Any]] = []
    seen_attrs: set[str] = set()

    if body_node is None:
        return methods, method_bodies, attributes

    for child in body_node.children:
        func_node = None
        func_decorators: list[str] = []

        if child.type == "function_definition":
            func_node = child
        elif child.type == "decorated_definition":
            defn = child.child_by_field_name("definition")
            if defn and defn.type == "function_definition":
                func_node = defn
                func_decorators = _extract_decorators(child, source)

        if func_node is not None:
            method_info, method_body = _extract_method(
                func_node, source, module_id, class_name, func_decorators
            )
            methods.append(method_info)
            method_bodies.append(method_body)

            # Extraer atributos de self.x del body del método
            if method_body is not None:
                # Tipos anotados explícitamente (self.x: Tipo = valor), si
                # los hay en este método — ver docstring de
                # `_extract_self_attribute_types` para el porqué de esto.
                annotated_types = _extract_self_attribute_types(method_body, source)

                for attr_name in extract_self_attributes(method_body):
                    if attr_name not in seen_attrs:
                        seen_attrs.add(attr_name)
                        attributes.append({
                            "name": attr_name,
                            "type": annotated_types.get(attr_name, "any"),
                            "visibility": "private" if attr_name.startswith("_") else "public",
                            "isStatic": False,
                            "isReadonly": False,
                        })

    return methods, method_bodies, attributes


def _extract_method(
    func_node, source: bytes, module_id: str, class_name: str,
    decorators: list[str]
) -> tuple[dict[str, Any], Any]:
    """Extrae un MethodInfo de un function_definition dentro de una clase."""
    name_node = func_node.child_by_field_name("name")
    name = _node_text(name_node, source) if name_node else "anonymous"

    params_node = func_node.child_by_field_name("parameters")
    all_params = _extract_parameters(params_node, source)
    # Filtrar self/cls del listado de parámetros expuestos
    params = [p for p in all_params if p["name"] not in ("self", "cls")]

    return_type_node = func_node.child_by_field_name("return_type")
    return_type = _node_text(return_type_node, source) if return_type_node else "None"

    body = func_node.child_by_field_name("body")
    cc = cyclomatic_complexity(body) if body else 1
    cog = cognitive_complexity(body) if body else 0
    loc = _count_node_lines(func_node)

    is_static = "staticmethod" in decorators
    is_abstract = "abstractmethod" in decorators
    is_async = any(c.type == "async" for c in func_node.children)

    # Determinar visibilidad por convención de Python
    if name.startswith("__") and not name.endswith("__"):
        visibility = "private"
    elif name.startswith("_"):
        visibility = "protected"
    else:
        visibility = "public"

    method_info = {
        "name": name,
        "visibility": visibility,
        "isStatic": is_static,
        "isAbstract": is_abstract,
        "isAsync": is_async,
        "isConstructor": name == "__init__",  # FIX: bandera explícita, misma
                                               # convención usada en java.py.
        "parameters": params,
        "returnType": return_type,
        "cyclomaticComplexity": cc,
        "cognitiveComplexity": cog,
        "loc": loc,
        "decorators": decorators,
    }

    return method_info, body


# ── Extracción de Funciones (top-level) ──

def _extract_functions(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """
    Extrae funciones de nivel superior (no métodos de clase), incluyendo
    las envueltas en `decorated_definition`. Soporta `async def`.
    """
    functions: list[dict[str, Any]] = []

    for child in root.children:
        func_node = None
        decorators: list[str] = []

        if child.type == "function_definition":
            func_node = child
        elif child.type == "decorated_definition":
            defn = child.child_by_field_name("definition")
            if defn and defn.type == "function_definition":
                func_node = defn
                decorators = _extract_decorators(child, source)

        if func_node is None:
            continue

        name_node = func_node.child_by_field_name("name")
        name = _node_text(name_node, source) if name_node else "anonymous"

        params_node = func_node.child_by_field_name("parameters")
        params = _extract_parameters(params_node, source)

        return_type_node = func_node.child_by_field_name("return_type")
        return_type = _node_text(return_type_node, source) if return_type_node else "None"

        body = func_node.child_by_field_name("body")
        cc = cyclomatic_complexity(body) if body else 1
        cog = cognitive_complexity(body) if body else 0
        loc = _count_node_lines(func_node)

        # Extraer llamadas desde el body
        calls = _extract_call_names(body) if body else []

        is_async = any(c.type == "async" for c in func_node.children)

        # Visibilidad por convención
        if name.startswith("__") and not name.endswith("__"):
            visibility = "private"
        elif name.startswith("_"):
            visibility = "protected"
        else:
            visibility = "public"

        functions.append({
            "id": f"{module_id}::{name}",
            "name": name,
            "visibility": visibility,
            "isExported": not name.startswith("_"),
            "isAsync": is_async,
            "parameters": params,
            "returnType": return_type,
            "cyclomaticComplexity": cc,
            "cognitiveComplexity": cog,
            "loc": loc,
            "calls": calls,
            "decorators": decorators,
        })

    return functions


def _extract_call_names(body_node) -> list[str]:
    """Extrae los nombres de las llamadas a funciones dentro de un nodo."""
    calls: list[str] = []

    def _visit(node):
        if node.type == "call":
            func = node.child_by_field_name("function")
            if func:
                calls.append(_node_text_fast(func))
        for child in node.children:
            _visit(child)

    _visit(body_node)
    return calls


def _node_text_fast(node) -> str:
    """Extrae el texto de un nodo usando su propio .text (bytes)."""
    return node.text.decode("utf-8", errors="replace") if node.text else ""


# ── Detección de Llamadas HTTP ──

_HTTP_CALL_FUNCTIONS = frozenset({
    "requests.get", "requests.post", "requests.put", "requests.delete",
    "requests.patch", "requests.head", "requests.options", "requests.request",
    "urllib.request.urlopen",
    "httpx.get", "httpx.post", "httpx.put", "httpx.delete",
    "httpx.patch", "httpx.head", "httpx.options", "httpx.request",
    "aiohttp.ClientSession",
})


def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas (requests, httpx, urllib)."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "call":
            func = node.child_by_field_name("function")
            if func:
                func_text = _node_text(func, source)
                if func_text in _HTTP_CALL_FUNCTIONS:
                    args = node.child_by_field_name("arguments")
                    first_arg = ""
                    if args:
                        for a in args.children:
                            if a.type not in ("(", ")", ","):
                                first_arg = _node_text(a, source)[:60]
                                break
                    calls.append({
                        "moduleId": module_id,
                        "externalSystemId": "http-api",
                        "protocol": "http",
                        "description": f"{func_text}({first_arg})" if first_arg else func_text,
                    })
        for child in node.children:
            _visit(child)

    _visit(root)
    return calls


# ── Helpers ──

def _count_node_lines(node) -> int:
    return node.end_point[0] - node.start_point[0] + 1


def _count_logical_lines(source: bytes) -> int:
    """LLOC: líneas no vacías y no comentarios."""
    lloc = 0
    in_docstring = False
    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        text = line.decode("utf-8", errors="replace")
        # Detectar docstrings triples
        triple = text.count('"""') + text.count("'''")
        if triple >= 2:
            continue  # Docstring de una sola línea
        if triple == 1:
            in_docstring = not in_docstring
            continue
        if in_docstring:
            continue
        if text.startswith("#"):
            continue
        lloc += 1
    return lloc


# ── Función principal ──

def parse_python_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Python, extrayendo la estructura completa
    del código y computando métricas locales.

    Args:
        file_path: Ruta del archivo.
        tree: Árbol de tree-sitter ya parseado.
        source: Código fuente en bytes.

    Returns:
        Dict compatible con WorkerAnalysisResult.module.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    # Extraer estructura
    imports_data = _extract_imports(root, source)
    classes, _ = _extract_classes(root, source, module_id)
    functions = _extract_functions(root, source, module_id)
    external_calls = _detect_external_calls(root, source, module_id)

    # Imports resueltos como IDs de módulo
    import_ids: list[str] = []
    for imp in imports_data:
        module = imp.get("module", "")
        if module and not imp.get("isRelative", False):
            import_ids.append(module)
        elif imp.get("isRelative"):
            # Para imports relativos, el ID estable será relativo al archivo
            import_ids.append(module)

    # LOC / LLOC
    loc = len(source.splitlines())
    lloc = _count_logical_lines(source)

    # Métricas a nivel de módulo
    all_cc = (
        [f["cyclomaticComplexity"] for f in functions]
        + [m["cyclomaticComplexity"] for c in classes for m in c.get("methods", [])]
    )
    cc_avg = sum(all_cc) / len(all_cc) if all_cc else 1.0
    cc_max = max(all_cc) if all_cc else 1

    total_classes = len(classes)
    abstract_classes = sum(1 for c in classes if c.get("isAbstract", False))
    abstractness = abstract_classes / total_classes if total_classes > 0 else 0.0

    ce = len(set(import_ids))

    # Maintainability Index (SEI formula adapted)
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
            "moduleType": "unknown",  # Se resuelve después por patterns
            "language": "python",
            "loc": loc,
            "lloc": lloc,
            "classes": classes,
            "functions": functions,
            "imports": list(set(import_ids)),
            "importedBy": [],
            "stableSince": "",
            "lastSeenIn": "",
            "metrics": {
                "ce": ce,
                "abstractness": round(abstractness, 4),
                "lcom4": 1,  # Module-level LCOM4 simplificado
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