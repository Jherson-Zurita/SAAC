"""
parsers/go.py — Parser AST detallado para archivos Go.

Usa tree-sitter para extraer imports, structs (clases), interfaces, métodos,
funciones globales, parámetros y calcular métricas locales.

Estructura del AST de tree-sitter-go:
  - Imports: `import_declaration` con `import_spec` o `import_spec_list`.
  - Estructuras: `type_declaration` > `type_spec` > `struct_type`.
  - Interfaces: `type_declaration` > `type_spec` > `interface_type`.
  - Funciones globales: `function_declaration` sin receiver.
  - Métodos: `method_declaration` con `.receiver` (`parameter_list` de 1 elemento).
  - Parámetros: `parameter_declaration` o `variadic_parameter_declaration`.
  - Visibilidad: Heurística Go (primera letra Mayúscula = public, Minúscula = private).

Referencia: §4.2 de la especificación técnica SAAC.
"""

from __future__ import annotations

import math
import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity, GO_COMPLEXITY_CONFIG
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
    Extrae todos los imports de un archivo Go.

    Mapea tanto imports individuales como bloques de importación.
    Limpia comillas y detecta alias si existen.
    """
    imports: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "import_declaration":
            # Puede ser import "os" o import ( "fmt"; f "strings" )
            spec_list = _child_by_type(child, "import_spec_list")
            specs = spec_list.children if spec_list else [c for c in child.children if c.type == "import_spec"]

            for s in specs:
                if s.type == "import_spec":
                    path_node = _child_by_type(s, "interpreted_string_literal") or _child_by_type(s, "raw_string_literal")
                    if path_node:
                        raw_path = _node_text(path_node, source)
                        # Quitar comillas
                        module_path = raw_path.strip('"`')

                        alias: str | None = None
                        alias_node = s.child_by_field_name("name") or _child_by_type(s, "package_identifier") or _child_by_type(s, "dot")
                        if alias_node:
                            alias = _node_text(alias_node, source)

                        imports.append({
                            "module": module_path,
                            "alias": alias,
                            "isStatic": False,
                            "isWildcard": alias == ".",
                            "isRelative": module_path.startswith("./") or module_path.startswith("../"),
                        })

    return imports


# ── Extracción de Parámetros ──

def _extract_parameters(params_node, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae los parámetros de un `parameter_list` de Go.

    Mapea `parameter_declaration` y `variadic_parameter_declaration` (...type).
    """
    params: list[dict[str, Any]] = []
    if params_node is None:
        return params

    for child in params_node.children:
        if child.type in ("(", ")", ","):
            continue

        if child.type == "parameter_declaration":
            # Estructura: identifier type_identifier (pueden ser múltiples nombres para un solo tipo: x, y int)
            # Para simplificar y mantener compatibilidad, asignamos el tipo a cada parámetro
            names: list[str] = []
            param_type = "any"

            for sub in child.children:
                if sub.type == "identifier":
                    names.append(_node_text(sub, source))
                elif sub.type in ("type_identifier", "pointer_type", "slice_type",
                                  "map_type", "channel_type", "qualified_type",
                                  "array_type"):
                    param_type = _node_text(sub, source)

            for name in names:
                params.append({
                    "name": name,
                    "type": param_type,
                    "isOptional": False,
                    "isVariadic": False,
                })

        elif child.type == "variadic_parameter_declaration":
            # Estructura: identifier '...' type_identifier
            param_name = ""
            param_type = "any"

            for sub in child.children:
                if sub.type == "identifier":
                    param_name = _node_text(sub, source)
                elif sub.type in ("type_identifier", "pointer_type", "slice_type",
                                  "qualified_type", "array_type"):
                    param_type = _node_text(sub, source)

            if param_name:
                params.append({
                    "name": param_name,
                    "type": param_type,
                    "isOptional": False,
                    "isVariadic": True,
                })

    return params


# ── Visibilidad en Go (Capitalización) ──

def _go_visibility(name: str) -> str:
    """
    Determina la visibilidad de un elemento en Go por su primera letra.
    Mayúscula = public (Exportado), Minúscula = private.
    """
    if not name:
        return "private"
    return "public" if name[0].isupper() else "private"


# ── Extractor de Atributos de Instancia Go para LCOM4 ──

def make_go_attribute_extractor(field_names: set[str], receiver_name: str) -> Any:
    """
    Construye una función para extraer los atributos de instancia accedidos
    en un método Go.

    En Go, el acceso es 100% explícito a través de la variable del receiver
    (ej: `c.Radius` donde `c` es el receiver de tipo `Circle`).
    Buscamos nodos `selector_expression` donde el operando (hijo 0) sea el
    receiver_name, y el campo (hijo 2) esté en field_names.
    """
    def extract_go_attributes(body_node) -> set[str]:
        attrs: set[str] = set()
        if not receiver_name:
            return attrs

        receiver_bytes = receiver_name.encode()

        def _visit(node):
            if node.type == "selector_expression":
                children = node.children
                if (
                    len(children) >= 3
                    and children[0].type == "identifier"
                    and children[0].text == receiver_bytes
                    and children[2].type == "field_identifier"
                ):
                    field_name = children[2].text.decode("utf-8", errors="replace")
                    if field_name in field_names:
                        attrs.add(field_name)

            for child in node.children:
                _visit(child)

        _visit(body_node)
        return attrs

    return extract_go_attributes


# ── Procesamiento de Clases (Structs e Interfaces) ──

def _extract_classes_and_structures(
    root, source: bytes, module_id: str
) -> list[dict[str, Any]]:
    """
    Extrae estructuras (structs) e interfaces definidas en el archivo Go.
    """
    classes: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "type_declaration":
            for sub in child.children:
                if sub.type == "type_spec":
                    name_node = sub.child_by_field_name("name")
                    raw_name = _node_text(name_node, source) if name_node else "Anonymous"

                    type_node = sub.child_by_field_name("type")
                    if type_node is None:
                        continue

                    is_interface = type_node.type == "interface_type"
                    is_struct = type_node.type == "struct_type"

                    if not (is_interface or is_struct):
                        continue

                    visibility = _go_visibility(raw_name)

                    # Atributos/Campos de Structs
                    attributes: list[dict[str, Any]] = []
                    if is_struct:
                        field_list = _child_by_type(type_node, "field_declaration_list")
                        if field_list:
                            for fd in field_list.children:
                                if fd.type == "field_declaration":
                                    # Estructura: identifier_list tipo
                                    fd_type_node = fd.child_by_field_name("type") or _child_by_type(fd, "type_identifier")
                                    fd_type = _node_text(fd_type_node, source) if fd_type_node else "any"

                                    # Nombres de campos
                                    names: list[str] = []
                                    for fd_child in fd.children:
                                        if fd_child.type == "field_identifier":
                                            names.append(_node_text(fd_child, source))

                                    for n in names:
                                        attributes.append({
                                            "name": n,
                                            "type": fd_type,
                                            "visibility": _go_visibility(n),
                                            "isStatic": False,
                                            "isReadonly": False,
                                        })

                    # Métodos de Interfaces (definidos directamente en su cuerpo)
                    methods: list[dict[str, Any]] = []
                    method_bodies: list = []
                    if is_interface:
                        method_list = _child_by_type(type_node, "method_spec_list")
                        if method_list:
                            for ms in method_list.children:
                                if ms.type == "method_spec":
                                    m_name_node = ms.child_by_field_name("name")
                                    m_name = _node_text(m_name_node, source) if m_name_node else "anonymous"

                                    params_node = ms.child_by_field_name("parameters")
                                    params = _extract_parameters(params_node, source)

                                    ret_node = ms.child_by_field_name("result")
                                    ret_type = _node_text(ret_node, source) if ret_node else "void"

                                    methods.append({
                                        "name": m_name,
                                        "visibility": _go_visibility(m_name),
                                        "isStatic": False,
                                        "isAbstract": True,
                                        "isAsync": False,
                                        "isConstructor": False,
                                        "parameters": params,
                                        "returnType": ret_type,
                                        "cyclomaticComplexity": 1,
                                        "cognitiveComplexity": 0,
                                        "loc": 1,
                                        "decorators": [],
                                    })
                                    method_bodies.append(None)

                    classes.append({
                        "id": f"{module_id}::{raw_name}",
                        "name": raw_name,
                        "isAbstract": is_interface,
                        "isInterface": is_interface,
                        "isStruct": is_struct,
                        "visibility": visibility,
                        "methods": methods,
                        "attributes": attributes,
                        "extends": [],
                        "implements": [],
                        "decorators": [],
                        "metrics": {
                            "wmc": 0,
                            "dit": 0,
                            "noc": 0,
                            "cbo": 0,
                            "rfc": 0,
                            "mpc": 0,
                            "lcom4": 0,
                            "tcc": 0.0,
                            "lcc": 0.0,
                        }
                    })

    return classes


# ── Extracción de Funciones Globales y Métodos de Estructuras ──

def _process_functions_and_methods(
    root, source: bytes, module_id: str, classes: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Procesa todas las funciones y métodos del archivo Go.
    Asocia métodos a sus estructuras (classes) correspondientes, y recopila
    las funciones globales del módulo.
    """
    global_functions: list[dict[str, Any]] = []

    # Mapas de conveniencia para asociar métodos rápidamente
    class_map = {cls["name"]: cls for cls in classes if cls.get("isStruct")}

    for child in root.children:
        is_func = child.type == "function_declaration"
        is_method = child.type == "method_declaration"

        if is_func or is_method:
            name_node = child.child_by_field_name("name")
            name = _node_text(name_node, source) if name_node else "anonymous"

            params_node = child.child_by_field_name("parameters")
            params = _extract_parameters(params_node, source)

            ret_node = child.child_by_field_name("result")
            ret_type = _node_text(ret_node, source) if ret_node else "void"

            body = child.child_by_field_name("body")
            cc = cyclomatic_complexity(body, GO_COMPLEXITY_CONFIG) if body else 1
            cog = cognitive_complexity(body, GO_COMPLEXITY_CONFIG) if body else 0
            loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

            method_info = {
                "name": name,
                "visibility": _go_visibility(name),
                "isStatic": not is_method,
                "isAbstract": False,
                "isAsync": False,
                "isConstructor": False, # En Go los constructores son funciones convencionales (ej: NewCircle)
                "parameters": params,
                "returnType": ret_type,
                "cyclomaticComplexity": cc,
                "cognitiveComplexity": cog,
                "loc": loc,
                "decorators": [],
            }

            if is_method:
                # Determinar receptor
                receiver_node = child.child_by_field_name("receiver")
                receiver_struct_name = ""
                receiver_var_name = ""

                if receiver_node:
                    # receiver_node es un parameter_list que contiene un parameter_declaration
                    # Ej: (c *Circle) o (c Circle)
                    for r_child in receiver_node.children:
                        if r_child.type == "parameter_declaration":
                            # Buscar variable del receptor
                            for p_sub in r_child.children:
                                if p_sub.type == "identifier":
                                    receiver_var_name = _node_text(p_sub, source)
                                    break
                            
                            # Buscar tipo del receptor (puede ser pointer_type o type_identifier)
                            type_n = r_child.child_by_field_name("type") or _child_by_type(r_child, "type_identifier") or _child_by_type(r_child, "pointer_type")
                            if type_n:
                                t_str = _node_text(type_n, source).strip()
                                # Si es un puntero (ej: *Circle), quitamos el '*'
                                receiver_struct_name = t_str.lstrip("*")

                # Asociar al struct
                target_cls = class_map.get(receiver_struct_name)
                if target_cls:
                    # Adjuntar información para calcular LCOM4 posteriormente
                    if "temp_method_data" not in target_cls:
                        target_cls["temp_method_data"] = []
                    target_cls["temp_method_data"].append((method_info, body, receiver_var_name))
            else:
                # Función global
                global_functions.append({
                    "id": f"{module_id}::{name}",
                    "name": name,
                    "visibility": _go_visibility(name),
                    "isExported": name[0].isupper() if name else False,
                    "isAsync": False,
                    "parameters": params,
                    "returnType": ret_type,
                    "cyclomaticComplexity": cc,
                    "cognitiveComplexity": cog,
                    "loc": loc,
                    "calls": [], # Opcional: llamadas locales
                    "decorators": [],
                })

    # Calcular métricas de cohesión definitivas para cada struct
    for cls in classes:
        if cls.get("isStruct"):
            methods_list = []
            bodies_list = []
            temp_data = cls.pop("temp_method_data", [])

            # Primero populamos los métodos y bodies
            for m_info, m_body, _ in temp_data:
                methods_list.append(m_info)
                bodies_list.append(m_body)

            cls["methods"] = methods_list

            # Configuramos extractor LCOM4
            field_names = {attr["name"] for attr in cls["attributes"]}
            # Consolidamos accesos de todos los métodos usando sus receivers particulares
            def dynamic_go_extractor(body_node) -> set[str]:
                # Buscar qué receiver_var correspondía a este body_node
                r_var = ""
                for _, b_node, var in temp_data:
                    if b_node == body_node:
                        r_var = var
                        break
                extractor = make_go_attribute_extractor(field_names, r_var)
                return extractor(body_node)

            cls["metrics"] = calculate_class_metrics(
                methods_list,
                bodies_list,
                cls["attributes"],
                attribute_extractor=dynamic_go_extractor,
                constructor_names=frozenset(), # Go no tiene constructores nativos OOP
            )

    return global_functions


# ── Detección de Llamadas HTTP Externas ──

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas (net/http)."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "call_expression":
            func_node = node.child_by_field_name("function")
            if func_node:
                func_text = _node_text(func_node, source)
                if any(
                    kw in func_text
                    for kw in ("http.Get", "http.Post", "http.PostForm", "http.Head", "http.Do", "http.Client")
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


# ── LLOC (Logical Lines of Code) ──

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


# ── Función Principal de Parseo Go ──

def parse_go_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Go, extrayendo estructuras, interfaces,
    funciones globales, imports, llamadas externas y métricas de complejidad/cohesión.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    # Extraer estructura base
    imports_data = _extract_imports(root, source)
    classes = _extract_classes_and_structures(root, source, module_id)
    global_functions = _process_functions_and_methods(root, source, module_id, classes)
    external_calls = _detect_external_calls(root, source, module_id)

    import_ids: list[str] = [imp["module"] for imp in imports_data]

    # LOC y LLOC
    loc = len(source.splitlines())
    lloc = _count_logical_lines(source)

    # Métricas del módulo
    all_cc = (
        [f["cyclomaticComplexity"] for f in global_functions]
        + [m["cyclomaticComplexity"] for c in classes for m in c.get("methods", [])]
    )
    cc_avg = sum(all_cc) / len(all_cc) if all_cc else 1.0
    cc_max = max(all_cc) if all_cc else 1

    total_classes = len(classes)
    abstract_classes = sum(1 for c in classes if c.get("isAbstract", False))
    abstractness = abstract_classes / total_classes if total_classes > 0 else 0.0

    ce = len(set(import_ids))

    # Maintainability Index
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
            "language": "go",
            "loc": loc,
            "lloc": lloc,
            "classes": classes,
            "functions": global_functions,
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


# ── Wrapper para __init__.py / Tests ──

def parse_go(file_path: str) -> dict[str, Any]:
    """Wrapper standalone que crea el parser y parsea el archivo."""
    from tree_sitter_language_pack import get_parser
    parser = get_parser("go")
    with open(file_path, "rb") as f:
        source = f.read()
    tree = parser.parse(source)
    return parse_go_file(file_path, tree, source)
