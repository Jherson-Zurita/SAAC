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
                                        "id": f"{module_id}::{raw_name}::{m_name}",
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
                                        "calls": [],  # method_spec de interfaz: sin body, nada que recorrer
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
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """
    Procesa todas las funciones y métodos del archivo Go.
    Asocia métodos a sus estructuras (classes) correspondientes, y recopila
    las funciones globales del módulo.

    Returns:
        (global_functions, receiver_var_by_method_id) — el segundo es un
        mapa id_de_método -> nombre de variable del receiver (ej. "c" en
        `func (c *Circle) Area()`), necesario en _extract_invocations para
        resolver llamadas `c.Metodo(...)` dentro de ese método, ya que Go
        no tiene un literal fijo como "self"/"this".
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

            # Llamadas dentro del body, necesarias para resolver `invocations`
            # a nivel de módulo (ver _extract_call_names / _extract_invocations).
            calls = _extract_call_names(body, source) if body else []

            # Determinar receptor (se calcula antes de armar method_info para
            # poder calificar su "id" con el nombre real del struct).
            receiver_struct_name = ""
            receiver_var_name = ""
            if is_method:
                receiver_node = child.child_by_field_name("receiver")
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

            qualified_id = (
                f"{module_id}::{receiver_struct_name}::{name}"
                if is_method and receiver_struct_name
                else f"{module_id}::{name}"
            )

            method_info = {
                "id": qualified_id,
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
                "calls": calls,
                "decorators": [],
            }

            if is_method:
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
                    "calls": calls,
                    "decorators": [],
                })

    # Calcular métricas de cohesión definitivas para cada struct, y
    # recolectar el nombre de variable del receiver de cada método (Go no
    # usa un literal fijo como "self"/"this" — el nombre lo elige quien
    # escribe el método, ej. `func (c *Circle) Area()` -> "c"). Se necesita
    # más adelante para resolver `c.Metodo(...)` en _extract_invocations.
    receiver_var_by_method_id: dict[str, str] = {}

    for cls in classes:
        if cls.get("isStruct"):
            methods_list = []
            bodies_list = []
            temp_data = cls.pop("temp_method_data", [])

            # Primero populamos los métodos y bodies
            for m_info, m_body, r_var in temp_data:
                methods_list.append(m_info)
                bodies_list.append(m_body)
                if m_info.get("id") and r_var:
                    receiver_var_by_method_id[m_info["id"]] = r_var

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

    return global_functions, receiver_var_by_method_id


# ── Extracción de Llamadas (para invocations) ──

def _extract_call_names(body_node, source: bytes) -> list[str]:
    """
    Extrae el texto de cada llamada a función/método dentro de un cuerpo.

    Reutiliza la misma forma de `call_expression` ya verificada en
    `_detect_external_calls`: field `function`, tomado como texto libre.
    En Go una llamada con receptor (`c.Metodo(...)`) es un
    `selector_expression` (mismo tipo de nodo que usa
    make_go_attribute_extractor para atributos) dentro de ese field — se
    devuelve tal cual aparece en el código: "Funcion" (sin receptor),
    "c.Metodo" (con receptor, donde "c" es el nombre real de variable, no
    necesariamente el receiver — ver limitación en _resolve_call_target),
    "pkg.Funcion" (llamada calificada por paquete importado).
    """
    calls: list[str] = []

    def _visit(node):
        if node.type == "call_expression":
            func_node = node.child_by_field_name("function")
            if func_node is not None:
                calls.append(_node_text(func_node, source))
        for child in node.children:
            _visit(child)

    if body_node is not None:
        _visit(body_node)
    return calls


# ── Resolución de Invocations ──
#
# `calls` (ver _extract_call_names) captura el TEXTO crudo de cada llamada:
# "Funcion" (global, sin receptor), "c.Metodo" (con receptor — "c" es el
# nombre de variable usado en el código, sea el receiver del método o
# cualquier otra variable local de tipo struct). Esta sección resuelve ese
# texto contra las funciones/métodos conocidos del PROPIO archivo,
# produciendo el arreglo "invocations". Llamadas a símbolos externos
# (paquetes importados, variables de tipo desconocido) requerirían
# inferencia de tipos — fuera del alcance de un parser de un solo archivo —
# y se omiten en vez de adivinar.

def _build_call_index(
    classes: list[dict[str, Any]], functions: list[dict[str, Any]]
) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """
    Construye índices para resolver llamadas dentro del archivo:

    - `by_simple_name`: nombre simple -> id calificado, para funciones
      globales y métodos. Si el mismo nombre existe en varios structs, se
      queda con el último visto — sin inferencia de tipos no hay forma de
      saber a cuál pertenece un receptor de tipo desconocido.
    - `methods_by_struct`: nombre de struct -> {nombre_metodo: id}, para
      resolver `receiver.Metodo` cuando se conoce a qué struct pertenece
      el método que está llamando (ver _resolve_call_target).
    """
    by_simple_name: dict[str, str] = {}
    methods_by_struct: dict[str, dict[str, str]] = {}

    for fn in functions:
        by_simple_name[fn["name"]] = fn["id"]

    for cls in classes:
        struct_name = cls["name"]
        methods_by_struct[struct_name] = {}
        for m in cls.get("methods", []):
            m_id = m.get("id")
            if not m_id:
                continue
            methods_by_struct[struct_name][m["name"]] = m_id
            by_simple_name[m["name"]] = m_id

    return by_simple_name, methods_by_struct


def _resolve_call_target(
    call_text: str,
    caller_struct: str | None,
    caller_receiver_var: str,
    by_simple_name: dict[str, str],
    methods_by_struct: dict[str, dict[str, str]],
) -> str | None:
    """
    Intenta resolver el texto de una llamada a un id calificado del
    archivo. Casos manejados, en orden:

      1. `receiver.Metodo(...)` donde `receiver` coincide EXACTAMENTE con
         el nombre de variable del receiver de `caller` (ej. `c` en
         `func (c *Circle) Area()`): se resuelve contra los métodos del
         propio struct del caller. Este es el único caso con receptor que
         se puede resolver con certeza, porque Go no tiene un literal fijo
         como "self" — el nombre de variable es lo único disponible, y
         solo es fiable cuando es precisamente el receiver del método que
         contiene la llamada.
      2. `Funcion(...)` sin receptor: función global o constructor
         convencional (`NewCircle`), resuelta contra `by_simple_name`.
      3. Cualquier otro caso con receptor (`otraVar.Metodo(...)`, incluida
         una variable local de tipo struct distinta del receiver, o un
         paquete importado como `pkg.Funcion`): no se resuelve — el tipo
         de `otraVar` es desconocido sin inferencia de tipos, y no se
         adivina.
    """
    if "." not in call_text:
        return by_simple_name.get(call_text)

    receiver, method_name = call_text.split(".", 1)

    if caller_struct is not None and caller_receiver_var and receiver == caller_receiver_var:
        return methods_by_struct.get(caller_struct, {}).get(method_name)

    return None


def _extract_invocations(
    classes: list[dict[str, Any]],
    functions: list[dict[str, Any]],
    receiver_var_by_method_id: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Construye el grafo de invocaciones (función/método -> función/método)
    dentro del propio archivo, a partir de los `calls` ya extraídos por
    `_process_functions_and_methods`.

    Cada entrada resuelta produce un dict:
        {"source": <id del caller>, "target": <id del callee>,
         "kind": "call", "weight": N}
    donde `weight` es el número de veces que `source` invoca a `target`
    (llamadas repetidas al mismo target dentro del mismo caller se agregan,
    en vez de producir entradas duplicadas).
    """
    by_simple_name, methods_by_struct = _build_call_index(classes, functions)

    # (source_id, target_id) -> weight
    weights: dict[tuple[str, str], int] = {}

    def _accumulate(
        source_id: str, caller_struct: str | None, receiver_var: str, calls: list[str]
    ):
        for call_text in calls:
            target_id = _resolve_call_target(
                call_text, caller_struct, receiver_var, by_simple_name, methods_by_struct
            )
            if target_id is None or target_id == source_id:
                continue  # No resuelto, o recursión directa (se omite).
            key = (source_id, target_id)
            weights[key] = weights.get(key, 0) + 1

    for fn in functions:
        _accumulate(fn["id"], None, "", fn.get("calls", []))

    for cls in classes:
        struct_name = cls["name"]
        for m in cls.get("methods", []):
            m_id = m.get("id")
            if not m_id:
                continue
            receiver_var = receiver_var_by_method_id.get(m_id, "")
            _accumulate(m_id, struct_name, receiver_var, m.get("calls", []))

    return [
        {"source": src, "target": tgt, "kind": "call", "weight": w}
        for (src, tgt), w in weights.items()
    ]


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
    global_functions, receiver_var_by_method_id = _process_functions_and_methods(
        root, source, module_id, classes
    )
    external_calls = _detect_external_calls(root, source, module_id)
    invocations = _extract_invocations(classes, global_functions, receiver_var_by_method_id)

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
        "invocations": invocations,
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