"""
parsers/swift.py — Parser AST detallado para archivos Swift.

Usa tree-sitter para extraer imports, clases/structs/protocols/extensions/enums,
métodos, inicializadores, propiedades y calcular métricas locales.

Estructura real del AST verificada contra tree-sitter-swift (dumps en
workers/python/scratch/dump_swift*.py):
  - Clases, structs y extensions comparten `class_declaration` como tipo
    de nodo; se distinguen por el primer token keyword hijo (`class`,
    `struct`, `extension`). protocols usan `protocol_declaration`.
  - Modifiers viven en un nodo `modifiers` contenedor.
  - Herencia usa nodos `inheritance_specifier` hermanos.
  - Parámetros tienen hasta 2 `simple_identifier` (label externo + nombre
    interno), tipo en `user_type`/`type_identifier`, y `...` para variadic.
  - Propiedades usan `value_binding_pattern` (let/var), `pattern` (nombre),
    `type_annotation`.

Referencia: §4.2 de la especificación técnica SAAC.
"""

from __future__ import annotations

import math
import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity, SWIFT_COMPLEXITY_CONFIG
from metrics.cohesion import calculate_class_metrics


# ── Helpers ──

def _node_text(node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _child_by_type(node, type_name: str) -> Any | None:
    for child in node.children:
        if child.type == type_name:
            return child
    return None


def _children_by_type(node, type_name: str) -> list:
    return [c for c in node.children if c.type == type_name]


# ── Extracción de Imports ──

def _extract_imports(root, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae imports de un archivo Swift.

    Verificado: import_declaration tiene un `import` keyword seguido de un
    `identifier` (que puede ser dotted: `Foundation`, `UIKit.UIView`).
    Opcionalmente tiene un kind keyword (`class`, `struct`, etc.) entre
    `import` y el identifier.
    """
    imports: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "import_declaration":
            module_name = ""
            for sub in child.children:
                if sub.type == "identifier":
                    module_name = _node_text(sub, source)
                    break

            if module_name:
                imports.append({
                    "module": module_name,
                    "isStatic": False,
                    "isWildcard": False,
                    "isRelative": False,
                })

    return imports


# ── Extracción de Parámetros ──

def _extract_parameters(func_node, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae parámetros de un function_declaration o init_declaration de Swift.

    Verificado contra el AST real:
      - Los parámetros son nodos `parameter` HERMANOS directos del
        function_declaration (entre `(` y `)`), NO dentro de un nodo
        `parameter_list`.
      - Cada `parameter` tiene 1 o 2 `simple_identifier` (label + nombre),
        seguidos de `:` y el tipo.
      - `...` indica variádico.
      - Default values: `=` seguido del valor como HERMANOS del
        function_declaration, NO dentro del `parameter`.
    """
    params: list[dict[str, Any]] = []

    children = list(func_node.children)
    i = 0
    while i < len(children):
        child = children[i]

        if child.type == "parameter":
            param: dict[str, Any] = {
                "name": "",
                "type": "Any",
                "isOptional": False,
                "isVariadic": False,
            }

            identifiers: list[str] = []
            for sub in child.children:
                if sub.type == "simple_identifier":
                    identifiers.append(_node_text(sub, source))
                elif sub.type in ("user_type", "type_identifier",
                                  "tuple_type", "array_type",
                                  "dictionary_type", "optional_type",
                                  "function_type"):
                    param["type"] = _node_text(sub, source)
                elif sub.type == "...":
                    param["isVariadic"] = True

            # Si hay 2 identifiers: primero es label externo, segundo es nombre interno
            # Si hay 1: es tanto label como nombre
            # Si label es "_": parámetro sin label (wildcard)
            if len(identifiers) >= 2:
                param["name"] = identifiers[1]  # nombre interno
            elif len(identifiers) == 1:
                param["name"] = identifiers[0]

            # Verificar si el siguiente hermano es `=` (default value)
            if i + 1 < len(children) and children[i + 1].type == "=":
                param["isOptional"] = True

            if param["name"] and param["name"] != "_":
                params.append(param)

        i += 1

    return params


# ── Extracción de Modificadores ──

def _parse_modifiers(node, source: bytes) -> tuple[str, bool, bool, list[str]]:
    """
    Parsea los modificadores de una declaración Swift.

    Verificado: los modificadores están envueltos en un nodo `modifiers`
    contenedor, con hijos de diversos tipos (visibility_modifier, property_modifier,
    etc.). La forma más robusta es comprobar el valor de texto de cada hijo.
    Default en Swift es `internal`.
    """
    visibility = "internal"
    is_static = False
    is_abstract = False
    decorators: list[str] = []

    mods_node = _child_by_type(node, "modifiers")
    if mods_node is None:
        return visibility, is_static, is_abstract, decorators

    for child in mods_node.children:
        mod_text = _node_text(child, source).strip()
        if mod_text in ("public", "open"):
            visibility = "public"
        elif mod_text in ("private", "fileprivate"):
            visibility = "private"
        elif mod_text == "internal":
            visibility = "internal"
        elif mod_text in ("static", "class"):
            is_static = True
        elif child.type == "attribute":
            # @objc, @available, etc.
            decorators.append(_node_text(child, source).lstrip("@"))

    return visibility, is_static, is_abstract, decorators


# ── Extractor de Atributos de Instancia Swift para LCOM4 ──

def make_swift_attribute_extractor(field_names: set[str]) -> Any:
    """
    Construye una función para extraer atributos de instancia accedidos
    dentro de un método/propiedad Swift, usando el conjunto de campos
    conocidos de la clase.

    En Swift, los atributos se acceden como `self.x` o directamente como `x`
    (acceso implícito). Para acceso explícito buscamos navigation_expression
    con `self` + `.` + identifier. Para acceso implícito, comparamos
    identifiers contra field_names conocidos.
    """
    def extract_swift_attributes(body_node) -> set[str]:
        attrs: set[str] = set()

        def _visit(node):
            # self.x → navigation_expression o member_access
            if node.type == "navigation_expression":
                children = node.children
                if (
                    len(children) >= 3
                    and children[0].type == "self_expression"
                    and children[2].type == "simple_identifier"
                ):
                    attrs.add(_node_text_fast(children[2]))
            elif node.type == "simple_identifier":
                name = _node_text_fast(node)
                if name in field_names:
                    parent = node.parent
                    if parent is not None:
                        # Evitar contar declaraciones o parámetros
                        if parent.type == "pattern":
                            pass
                        elif parent.type == "parameter":
                            pass
                        elif parent.type == "navigation_expression":
                            # Ya manejado arriba
                            pass
                        else:
                            attrs.add(name)
                    else:
                        attrs.add(name)

            for child in node.children:
                _visit(child)

        _visit(body_node)
        return attrs

    return extract_swift_attributes


def _node_text_fast(node) -> str:
    return node.text.decode("utf-8", errors="replace") if node.text else ""


# ── Extracción de Clases/Structs/Protocols/Extensions ──

def _extract_classes_and_structures(
    root, source: bytes, module_id: str
) -> list[dict[str, Any]]:
    """
    Extrae clases, structs, protocols, enums y extensions del archivo Swift.

    Verificado:
      - class, struct y extension comparten `class_declaration` como tipo
        de nodo en tree-sitter-swift. Se distinguen por el primer token
        keyword hijo (`class`, `struct`, `extension`).
      - `protocol_declaration` es un tipo de nodo separado.
      - `enum_declaration` tiene su propio tipo.
      - Herencia: nodos `inheritance_specifier` hermanos directos de la
        declaración, conteniendo un `user_type`.
    """
    classes: list[dict[str, Any]] = []

    def _traverse(node, parent_class_name: str | None = None):
        is_class_decl = node.type == "class_declaration"
        is_protocol = node.type == "protocol_declaration"
        is_enum = node.type == "enum_declaration"

        if is_class_decl or is_protocol or is_enum:
            # Determinar el tipo real (class, struct, extension, protocol, enum)
            kind = "class"
            if is_protocol:
                kind = "protocol"
            elif is_enum:
                kind = "enum"
            elif is_class_decl:
                # Distinguir class vs struct vs extension por primer keyword
                for child in node.children:
                    if child.type == "struct":
                        kind = "struct"
                        break
                    elif child.type == "extension":
                        kind = "extension"
                        break
                    elif child.type == "class":
                        kind = "class"
                        break

            # Nombre
            name_node = node.child_by_field_name("name")
            raw_name = _node_text(name_node, source) if name_node else "Anonymous"
            name = f"{parent_class_name}.{raw_name}" if parent_class_name else raw_name

            # Modificadores
            visibility, is_static, is_abstract, decorators = _parse_modifiers(node, source)

            if is_protocol:
                is_abstract = True

            # Herencia: nodos `inheritance_specifier` hermanos
            extends: list[str] = []
            implements: list[str] = []
            inheritance_names: list[str] = []
            for child in node.children:
                if child.type == "inheritance_specifier":
                    # Dentro hay un user_type > type_identifier
                    inh_text = _node_text(child, source).strip()
                    if inh_text:
                        inheritance_names.append(inh_text)

            if inheritance_names and kind == "class":
                # En Swift, la superclase va primero (si es una clase, no un
                # protocolo). Heurística: los protocolos suelen empezar con
                # mayúscula y pueden ser cualquier cosa, pero la superclase
                # generalmente es un nombre conocido. Como no podemos
                # distinguir con certeza, tomamos el primero como extends
                # si hay más de uno y el resto como implements.
                extends.append(inheritance_names[0])
                implements.extend(inheritance_names[1:])
            elif inheritance_names:
                implements.extend(inheritance_names)

            # Body
            body_node = node.child_by_field_name("body")
            methods, method_bodies, attributes = _extract_members(
                body_node, source, module_id, name, is_protocol
            )

            # LCOM4
            field_names = {attr["name"] for attr in attributes}
            extract_attrs_fn = make_swift_attribute_extractor(field_names)
            metrics = calculate_class_metrics(
                methods,
                method_bodies,
                attributes,
                attribute_extractor=extract_attrs_fn,
                constructor_names=frozenset({"init"}),
            )

            classes.append({
                "id": f"{module_id}::{name}",
                "name": name,
                "isAbstract": is_abstract,
                "isInterface": is_protocol,
                "isStruct": kind == "struct",
                "isExtension": kind == "extension",
                "isEnum": kind == "enum",
                "visibility": visibility,
                "methods": methods,
                "attributes": attributes,
                "extends": extends,
                "implements": implements,
                "decorators": decorators,
                "metrics": metrics,
            })

            # Buscar clases internas
            if body_node:
                for child in body_node.children:
                    _traverse(child, name)
        else:
            for child in node.children:
                _traverse(child, parent_class_name)

    _traverse(root)
    return classes


# ── Extracción de Miembros ──

def _extract_members(
    body_node, source: bytes, module_id: str, class_name: str, is_protocol: bool
) -> tuple[list[dict], list, list[dict]]:
    """
    Extrae métodos, inicializadores y propiedades del cuerpo de una clase/struct/protocol.
    """
    methods: list[dict[str, Any]] = []
    method_bodies: list = []
    attributes: list[dict[str, Any]] = []

    if body_node is None:
        return methods, method_bodies, attributes

    for child in body_node.children:
        is_func = child.type == "function_declaration"
        is_init = child.type == "init_declaration"

        if is_func or is_init:
            if is_func:
                name_node = child.child_by_field_name("name")
                name = _node_text(name_node, source) if name_node else "anonymous"
            else:
                name = "init"

            params = _extract_parameters(child, source)

            ret_type = "Void"
            if is_func:
                ret_node = child.child_by_field_name("return_type")
                if ret_node:
                    ret_type = _node_text(ret_node, source)

            visibility, is_static, is_abstract, decorators = _parse_modifiers(child, source)

            if is_protocol and not is_abstract:
                # En protocols, los métodos sin body son implícitamente abstractos
                body_check = child.child_by_field_name("body")
                is_abstract = body_check is None

            body = child.child_by_field_name("body")
            cc = cyclomatic_complexity(body, SWIFT_COMPLEXITY_CONFIG) if body else 1
            cog = cognitive_complexity(body, SWIFT_COMPLEXITY_CONFIG) if body else 0
            loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

            # Llamadas dentro del body, necesarias para resolver `invocations`
            # a nivel de módulo (ver _extract_call_names / _extract_invocations).
            calls = _extract_call_names(body, source) if body else []

            methods.append({
                "id": f"{module_id}::{class_name}::{name}",
                "name": name,
                "visibility": visibility,
                "isStatic": is_static,
                "isAbstract": is_abstract,
                "isAsync": False,  # TODO: detectar async en Swift
                "isConstructor": is_init,
                "parameters": params,
                "returnType": ret_type,
                "cyclomaticComplexity": cc,
                "cognitiveComplexity": cog,
                "loc": loc,
                "calls": calls,
                "decorators": decorators,
            })
            method_bodies.append(body)

        elif child.type == "property_declaration":
            # Propiedades: var/let con pattern y type_annotation
            visibility, is_static, _, decorators = _parse_modifiers(child, source)

            name_node = child.child_by_field_name("name")
            prop_name = _node_text(name_node, source) if name_node else "unknown"

            # Tipo: extraer de type_annotation
            prop_type = "Any"
            for sub in child.children:
                if sub.type == "type_annotation":
                    for ta_child in sub.children:
                        if ta_child.type in ("user_type", "type_identifier",
                                             "optional_type", "array_type",
                                             "dictionary_type", "tuple_type"):
                            prop_type = _node_text(ta_child, source)
                            break

            # let = readonly, var = mutable
            is_readonly = False
            for sub in child.children:
                if sub.type == "value_binding_pattern":
                    binding_text = _node_text(sub, source).strip()
                    if binding_text == "let":
                        is_readonly = True
                    break

            attributes.append({
                "name": prop_name,
                "type": prop_type,
                "visibility": visibility,
                "isStatic": is_static,
                "isReadonly": is_readonly,
            })

    return methods, method_bodies, attributes


# ── Extracción de Llamadas (para invocations) ──

def _extract_call_names(body_node, source: bytes) -> list[str]:
    """
    Extrae el texto de cada llamada a función/método dentro de un cuerpo.

    Reutiliza el mismo patrón POSICIONAL ya usado en `_detect_external_calls`
    para identificar el callee de un `call_expression`: el primer hijo de
    tipo `simple_identifier` (llamada sin receptor: "metodo(...)") o
    `navigation_expression` (llamada con receptor: "self.metodo(...)",
    "obj.metodo(...)"), tomado como texto completo. A diferencia de C#/Java
    (donde el research SÍ confirmó un field name "function" para el
    callee), aquí no hay evidencia en este archivo de que exista ese field
    en tree-sitter-swift — se mantiene el mismo enfoque posicional que ya
    se usaba, en vez de introducir una suposición nueva sin verificar.
    """
    calls: list[str] = []

    def _visit(node):
        if node.type == "call_expression":
            for sub in node.children:
                if sub.type in ("simple_identifier", "navigation_expression"):
                    calls.append(_node_text(sub, source))
                    break
        for child in node.children:
            _visit(child)

    if body_node is not None:
        _visit(body_node)
    return calls


# ── Resolución de Invocations ──
#
# `calls` (ver _extract_call_names) captura el TEXTO crudo de cada llamada:
# "metodo" (sin receptor), "self.metodo", "obj.metodo". A diferencia de
# otros lenguajes, en Swift una `navigation_expression` puede encadenar
# más de un nivel (ej. "a.b.metodo") — solo se resuelve el caso de UN
# receptor directo (mismo alcance que los demás parsers de esta serie);
# cadenas más largas no se resuelven, no se rompen a mitad ni se adivinan.
# Esta sección resuelve el texto contra los métodos conocidos del PROPIO
# archivo (incluidos tipos anidados), produciendo el arreglo "invocations".
# Llamadas a símbolos externos (imports, librerías, receptores de tipo
# desconocido) requerirían inferencia de tipos — fuera del alcance de un
# parser de un solo archivo — y se omiten en vez de adivinar.

def _build_call_index(
    classes: list[dict[str, Any]],
) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """
    Construye índices para resolver llamadas dentro del archivo:

    - `by_simple_name`: nombre simple de método -> id calificado. Si el
      mismo nombre existe en varios tipos, se queda con el último visto —
      sin inferencia de tipos no hay forma de saber a cuál pertenece un
      receptor de tipo desconocido.
    - `methods_by_type`: nombre de tipo (puede ser calificado, ej.
      "Outer.Inner") -> {nombre_metodo: id}, para resolver `self.metodo`
      con receptor conocido y `Tipo.metodo` por nombre explícito (llamadas
      estáticas o a métodos de tipo).
    """
    by_simple_name: dict[str, str] = {}
    methods_by_type: dict[str, dict[str, str]] = {}

    for cls in classes:
        type_name = cls["name"]
        methods_by_type[type_name] = {}
        for m in cls.get("methods", []):
            m_id = m.get("id")
            if not m_id:
                continue
            methods_by_type[type_name][m["name"]] = m_id
            by_simple_name[m["name"]] = m_id

    return by_simple_name, methods_by_type


def _resolve_call_target(
    call_text: str,
    caller_type: str,
    by_simple_name: dict[str, str],
    methods_by_type: dict[str, dict[str, str]],
) -> str | None:
    """
    Intenta resolver el texto de una llamada a un id calificado del
    archivo. Casos manejados, en orden:

      1. `metodo(...)` sin receptor: se prueba primero contra el propio
         tipo del caller y, si no está ahí, contra `by_simple_name` como
         fallback (otro tipo con un método del mismo nombre).
      2. `self.metodo(...)`: se resuelve contra los métodos de
         `caller_type` (receptor conocido).
      3. `Tipo.metodo(...)`: se resuelve contra `methods_by_type` si
         `Tipo` es un tipo conocido del archivo (llamada estática/de tipo,
         incluye tipos anidados si se pasa el nombre calificado).
      4. Cualquier otro caso (receptor de tipo desconocido, variable
         local, cadena de más de un nivel como "a.b.metodo", símbolo
         importado, etc.): no se resuelve — se devuelve None y el caller
         la descarta.
    """
    if "." not in call_text:
        return methods_by_type.get(caller_type, {}).get(call_text) \
            or by_simple_name.get(call_text)

    parts = call_text.split(".")
    if len(parts) != 2:
        # Cadena de más de un nivel (a.b.metodo): no hay suficiente
        # información de tipos para saber el receptor real.
        return None

    receiver, method_name = parts

    if receiver == "self":
        return methods_by_type.get(caller_type, {}).get(method_name)

    if receiver in methods_by_type:
        return methods_by_type[receiver].get(method_name)

    return None


def _extract_invocations(classes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Construye el grafo de invocaciones (método -> método) dentro del propio
    archivo, a partir de los `calls` ya extraídos por `_extract_members`.

    Cada entrada resuelta produce un dict:
        {"source": <id del caller>, "target": <id del callee>,
         "kind": "call", "weight": N}
    donde `weight` es el número de veces que `source` invoca a `target`
    (llamadas repetidas al mismo target dentro del mismo caller se agregan,
    en vez de producir entradas duplicadas).
    """
    by_simple_name, methods_by_type = _build_call_index(classes)

    # (source_id, target_id) -> weight
    weights: dict[tuple[str, str], int] = {}

    for cls in classes:
        type_name = cls["name"]
        for m in cls.get("methods", []):
            source_id = m.get("id")
            if not source_id:
                continue
            for call_text in m.get("calls", []):
                target_id = _resolve_call_target(
                    call_text, type_name, by_simple_name, methods_by_type
                )
                if target_id is None or target_id == source_id:
                    continue  # No resuelto, o recursión directa (se omite).
                key = (source_id, target_id)
                weights[key] = weights.get(key, 0) + 1

    return [
        {"source": src, "target": tgt, "kind": "call", "weight": w}
        for (src, tgt), w in weights.items()
    ]


# ── Detección de Llamadas HTTP Externas ──

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas (URLSession, Alamofire)."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "call_expression":
            func_text = ""
            for sub in node.children:
                if sub.type == "simple_identifier":
                    func_text = _node_text(sub, source)
                    break
                elif sub.type == "navigation_expression":
                    func_text = _node_text(sub, source)
                    break

            if func_text and any(
                kw in func_text
                for kw in ("URLSession", "dataTask", "Alamofire", "AF.")
            ):
                calls.append({
                    "moduleId": module_id,
                    "externalSystemId": "http-api",
                    "protocol": "http",
                    "description": func_text[:60],
                })

        for child in node.children:
            _visit(child)

    _visit(root)
    return calls


# ── Helpers ──

def _count_logical_lines(source: bytes) -> int:
    """LLOC: líneas no vacías y no comentarios."""
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


# ── Función Principal ──

def parse_swift_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Swift, extrayendo clases, métodos,
    imports, llamadas externas y calculando sus métricas.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    imports_data = _extract_imports(root, source)
    classes = _extract_classes_and_structures(root, source, module_id)
    external_calls = _detect_external_calls(root, source, module_id)
    invocations = _extract_invocations(classes)

    import_ids: list[str] = [imp["module"] for imp in imports_data]

    loc = len(source.splitlines())
    lloc = _count_logical_lines(source)

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

    lloc_safe = max(lloc, 1)
    loc_safe = max(loc, 1)
    raw_mi = 171 - 5.2 * math.log(lloc_safe) - 0.23 * cc_avg - 16.2 * math.log(loc_safe)
    mi = max(0.0, min(100.0, (raw_mi * 100) / 171))

    return {
        "module": {
            "id": module_id,
            "type": "module",
            "name": module_name,
            "moduleType": "unknown",
            "language": "swift",
            "loc": loc,
            "lloc": lloc,
            "classes": classes,
            "functions": [],  # Swift no tiene funciones globales en el sentido de SAAC
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
        "invocations": invocations,
        "externalCalls": external_calls,
        "rawImports": imports_data,
    }


# ── Wrapper para __init__.py ──

def parse_swift(file_path: str) -> dict[str, Any]:
    """Wrapper standalone que crea el parser y parsea el archivo."""
    from tree_sitter_language_pack import get_parser
    parser = get_parser("swift")
    with open(file_path, "rb") as f:
        source = f.read()
    tree = parser.parse(source)
    return parse_swift_file(file_path, tree, source)