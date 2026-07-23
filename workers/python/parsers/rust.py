"""
parsers/rust.py — Parser AST detallado para archivos Rust.

Usa tree-sitter para extraer imports (use_declaration), structs, enums,
traits, bloques de implementación (impl), funciones globales y calcular
métricas locales de complejidad y cohesión (LCOM4).

Estructura del AST de tree-sitter-rust:
  - Imports: `use_declaration` (puede incluir alias `use_as_clause`, wildcard `use_wildcard`, etc.).
  - Estructuras: `struct_item` con `.name` y `.body`.
  - Traits (Interfaces): `trait_item`.
  - Enums: `enum_item`.
  - Bloques Impl: `impl_item` con `.type` (struct), `.trait` (si implementa un trait), y `.body` (lista de métodos).
  - Métodos/Funciones: `function_item`. Si tiene un `self_parameter` (como `&self`), es un método; si no, es estático.
  - Parámetros: `parameter` (con identifier y tipo) y `self_parameter`.

Referencia: §4.2 de la especificación técnica SAAC.
"""

from __future__ import annotations

import math
import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity, RUST_COMPLEXITY_CONFIG
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
    Extrae todos los imports (use declarations) de un archivo Rust.

    Mapea imports simples, wildcards (`*`), alias (`as`) y agrupamientos (`{}`).
    """
    imports: list[dict[str, Any]] = []

    def _process_use_path(node, prefix=""):
        if node.type == "scoped_identifier":
            path = _node_text(node, source)
            full_path = f"{prefix}::{path}" if prefix else path
            imports.append({
                "module": full_path,
                "isStatic": False,
                "isWildcard": False,
                "isRelative": full_path.startswith("self::") or full_path.startswith("super::"),
            })
        elif node.type == "use_wildcard":
            # Ej: crate::qux::*
            scoped = _child_by_type(node, "scoped_identifier")
            path = _node_text(scoped, source) if scoped else ""
            full_path = f"{prefix}::{path}" if prefix else path
            imports.append({
                "module": full_path,
                "isStatic": False,
                "isWildcard": True,
                "isRelative": full_path.startswith("self::") or full_path.startswith("super::"),
            })
        elif node.type == "use_as_clause":
            # Ej: std::io as my_io
            scoped = _child_by_type(node, "scoped_identifier")
            path = _node_text(scoped, source) if scoped else ""
            alias_node = node.child_by_field_name("alias") or _child_by_type(node, "identifier")
            alias = _node_text(alias_node, source) if alias_node else None
            full_path = f"{prefix}::{path}" if prefix else path
            imports.append({
                "module": full_path,
                "alias": alias,
                "isStatic": False,
                "isWildcard": False,
                "isRelative": full_path.startswith("self::") or full_path.startswith("super::"),
            })
        elif node.type == "scoped_use_list":
            # Ej: std::fmt::{self, Debug}
            scoped = _child_by_type(node, "scoped_identifier")
            path = _node_text(scoped, source) if scoped else ""
            full_prefix = f"{prefix}::{path}" if prefix else path
            
            use_list = _child_by_type(node, "use_list")
            if use_list:
                for child in use_list.children:
                    if child.type in ("identifier", "self", "use_as_clause", "use_wildcard"):
                        _process_use_path(child, full_prefix)
        elif node.type in ("identifier", "self"):
            path = _node_text(node, source)
            full_path = f"{prefix}::{path}" if prefix else path
            imports.append({
                "module": full_path,
                "isStatic": False,
                "isWildcard": False,
                "isRelative": full_path.startswith("self::") or full_path.startswith("super::"),
            })

    for child in root.children:
        if child.type == "use_declaration":
            # El hijo útil es el que no es 'use' ni ';'
            for sub in child.children:
                if sub.type not in ("use", ";"):
                    _process_use_path(sub)

    return imports


# ── Extracción de Parámetros ──

def _extract_parameters(params_node, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae la lista de parámetros de una función o método de Rust.

    Filtra parámetros de tipo `self` (`&self`, `self`, `mut self`) de la firma visible
    de parámetros, para consistencia con otros lenguajes.
    """
    params: list[dict[str, Any]] = []
    if params_node is None:
        return params

    for child in params_node.children:
        if child.type in ("(", ")", ","):
            continue

        if child.type == "parameter":
            # Estructura: pattern (identifier) ':' type
            # Rust también soporta destructuración, pero mapeamos el patrón simple
            param_name = ""
            param_type = "any"

            pattern_n = child.child_by_field_name("pattern")
            if pattern_n:
                param_name = _node_text(pattern_n, source)
            
            type_n = child.child_by_field_name("type")
            if type_n:
                param_type = _node_text(type_n, source)

            if param_name:
                params.append({
                    "name": param_name,
                    "type": param_type,
                    "isOptional": False,
                    "isVariadic": False,
                })

    return params


# ── Visibilidad en Rust ──

def _rust_visibility(node, source: bytes) -> str:
    """Determina si un nodo es público en base a la presencia del modificador `pub`."""
    vis_node = _child_by_type(node, "visibility_modifier")
    if vis_node:
        txt = _node_text(vis_node, source).strip()
        if txt.startswith("pub"):
            return "public"
    return "private"


# ── Extractor de Atributos de Instancia Rust para LCOM4 ──

def make_rust_attribute_extractor(field_names: set[str]) -> Any:
    """
    Construye una función para extraer los atributos de instancia accedidos
    en un método Rust.

    En Rust, el acceso a atributos siempre es a través de `self` (ej: `self.radius`).
    Buscamos nodos `field_expression` donde el objeto (hijo 0) sea `self` (o de tipo `self`),
    y el campo (hijo 2) esté en field_names.
    """
    def extract_rust_attributes(body_node) -> set[str]:
        attrs: set[str] = set()

        def _visit(node):
            if node.type == "field_expression":
                children = node.children
                if (
                    len(children) >= 3
                    and children[0].text == b"self"
                    and children[2].type == "field_identifier"
                ):
                    field_name = children[2].text.decode("utf-8", errors="replace")
                    if field_name in field_names:
                        attrs.add(field_name)

            for child in node.children:
                _visit(child)

        _visit(body_node)
        return attrs

    return extract_rust_attributes


# ── Procesamiento de Clases (Structs, Enums, Traits e Impls) ──

def _extract_classes_and_structures(
    root, source: bytes, module_id: str
) -> list[dict[str, Any]]:
    """
    Extrae structs, enums y traits definidos en el archivo Rust, y
    resuelve sus bloques `impl` asociados.
    """
    classes: list[dict[str, Any]] = []

    # 1. Primera pasada: extraer structs, traits y enums (representan "clases" o "interfaces")
    for child in root.children:
        is_struct = child.type == "struct_item"
        is_trait = child.type == "trait_item"
        is_enum = child.type == "enum_item"

        if is_struct or is_trait or is_enum:
            name_node = child.child_by_field_name("name")
            raw_name = _node_text(name_node, source) if name_node else "Anonymous"

            visibility = _rust_visibility(child, source)

            # Atributos (campos del struct)
            attributes: list[dict[str, Any]] = []
            if is_struct:
                body_node = child.child_by_field_name("body")
                if body_node:
                    # body puede ser struct field_declaration_list
                    for fd in body_node.children:
                        if fd.type == "field_declaration":
                            fd_name_node = fd.child_by_field_name("name")
                            fd_name = _node_text(fd_name_node, source) if fd_name_node else "unknown"

                            fd_type_node = fd.child_by_field_name("type")
                            fd_type = _node_text(fd_type_node, source) if fd_type_node else "any"

                            fd_visibility = _rust_visibility(fd, source)

                            attributes.append({
                                "name": fd_name,
                                "type": fd_type,
                                "visibility": fd_visibility,
                                "isStatic": False,
                                "isReadonly": False, # Rust usa mutabilidad por variable/referencia, no a nivel de declaración de campo
                            })

            classes.append({
                "id": f"{module_id}::{raw_name}",
                "name": raw_name,
                "isAbstract": is_trait,
                "isInterface": is_trait,
                "isStruct": is_struct,
                "isEnum": is_enum,
                "visibility": visibility,
                "methods": [],
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

    # 2. Segunda pasada: procesar bloques impl y asociar métodos
    # Mapas de búsqueda rápida
    class_map = {cls["name"]: cls for cls in classes if cls.get("isStruct") or cls.get("isEnum")}

    # Almacenamiento temporal para calcular cohesión después
    # struct_name -> list of (method_info, body_node, is_instance)
    temp_impl_data: dict[str, list] = {}

    for child in root.children:
        if child.type == "impl_item":
            # Extraer tipo asociado (struct)
            type_node = child.child_by_field_name("type")
            if type_node is None:
                continue

            struct_name = _node_text(type_node, source).strip().lstrip("&")
            # impl MyStruct -> struct_name es "MyStruct"
            # impl Drawable for MyStruct -> struct_name es "MyStruct"
            
            trait_node = child.child_by_field_name("trait")
            trait_name = _node_text(trait_node, source).strip() if trait_node else ""

            # Si es implementación de un trait, registramos la relación implements
            target_cls = class_map.get(struct_name)
            if target_cls and trait_name:
                if trait_name not in target_cls["implements"]:
                    target_cls["implements"].append(trait_name)

            # Extraer métodos del cuerpo del impl
            body_node = child.child_by_field_name("body")
            if body_node:
                for member in body_node.children:
                    if member.type == "function_item":
                        m_name_node = member.child_by_field_name("name")
                        m_name = _node_text(m_name_node, source) if m_name_node else "anonymous"

                        params_node = member.child_by_field_name("parameters")
                        params = _extract_parameters(params_node, source)

                        ret_node = member.child_by_field_name("return_type")
                        ret_type = _node_text(ret_node, source) if ret_node else "void"

                        # Visibilidad
                        m_visibility = _rust_visibility(member, source)

                        # Determinar si es método de instancia o estático
                        # Si tiene `self_parameter` como primer hijo de parameters
                        is_instance = False
                        if params_node:
                            for p_child in params_node.children:
                                if p_child.type == "self_parameter":
                                    is_instance = True
                                    break
                                elif p_child.type == "parameter":
                                    # Los parámetros normales van después del self, terminamos búsqueda
                                    break

                        body = member.child_by_field_name("body")
                        cc = cyclomatic_complexity(body, RUST_COMPLEXITY_CONFIG) if body else 1
                        cog = cognitive_complexity(body, RUST_COMPLEXITY_CONFIG) if body else 0
                        loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

                        # Llamadas dentro del body, necesarias para resolver
                        # `invocations` a nivel de módulo (ver
                        # _extract_call_names / _extract_invocations).
                        calls = _extract_call_names(body, source) if body else []

                        method_info = {
                            "id": f"{module_id}::{struct_name}::{m_name}",
                            "name": m_name,
                            "visibility": m_visibility,
                            "isStatic": not is_instance,
                            "isAbstract": False,
                            "isAsync": any(c.type == "async" for c in member.children),
                            "isConstructor": m_name == "new", # Convención común en Rust
                            "parameters": params,
                            "returnType": ret_type,
                            "cyclomaticComplexity": cc,
                            "cognitiveComplexity": cog,
                            "loc": loc,
                            "calls": calls,
                            "decorators": [],
                        }

                        if struct_name not in temp_impl_data:
                            temp_impl_data[struct_name] = []
                        temp_impl_data[struct_name].append((method_info, body))

    # 3. Consolidar métodos y calcular cohesión
    for cls in classes:
        struct_name = cls["name"]
        if struct_name in temp_impl_data:
            methods_list = []
            bodies_list = []
            for m_info, m_body in temp_impl_data[struct_name]:
                methods_list.append(m_info)
                bodies_list.append(m_body)

            cls["methods"] = methods_list

            # Métricas
            field_names = {attr["name"] for attr in cls["attributes"]}
            extract_attrs_fn = make_rust_attribute_extractor(field_names)

            cls["metrics"] = calculate_class_metrics(
                methods_list,
                bodies_list,
                cls["attributes"],
                attribute_extractor=extract_attrs_fn,
                constructor_names=frozenset({"new"}),
            )

    return classes


# ── Extracción de Funciones Globales ──

def _extract_global_functions(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Extrae las funciones del nivel superior (globales) de Rust."""
    functions: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "function_item":
            name_node = child.child_by_field_name("name")
            name = _node_text(name_node, source) if name_node else "anonymous"

            params_node = child.child_by_field_name("parameters")
            params = _extract_parameters(params_node, source)

            ret_node = child.child_by_field_name("return_type")
            ret_type = _node_text(ret_node, source) if ret_node else "void"

            visibility = _rust_visibility(child, source)

            body = child.child_by_field_name("body")
            cc = cyclomatic_complexity(body, RUST_COMPLEXITY_CONFIG) if body else 1
            cog = cognitive_complexity(body, RUST_COMPLEXITY_CONFIG) if body else 0
            loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

            # Llamadas dentro del body, necesarias para resolver `invocations`
            # a nivel de módulo (ver _extract_call_names / _extract_invocations).
            calls = _extract_call_names(body, source) if body else []

            functions.append({
                "id": f"{module_id}::{name}",
                "name": name,
                "visibility": visibility,
                "isExported": visibility == "public",
                "isAsync": any(c.type == "async" for c in child.children),
                "parameters": params,
                "returnType": ret_type,
                "cyclomaticComplexity": cc,
                "cognitiveComplexity": cog,
                "loc": loc,
                "calls": calls,
                "decorators": [],
            })

    return functions


# ── Extracción de Llamadas (para invocations) ──

def _extract_call_names(body_node, source: bytes) -> list[str]:
    """
    Extrae las llamadas a funciones/métodos dentro de un cuerpo, cubriendo
    las DOS sintaxis de llamada de Rust (ambas producen un `call_expression`
    con field `function`, pero con forma interna distinta):

      - `self.metodo(...)` / `obj.metodo(...)`: el field `function` es un
        `field_expression` (mismo nodo que usa make_rust_attribute_extractor
        para atributos, aquí con receptor + `field_identifier`). Se
        devuelve como "self.metodo" / "obj.metodo".
      - `Struct::metodo(...)` / `funcion(...)`: el field `function` es un
        `scoped_identifier` (ruta completa, ej. "Struct::new") o un
        `identifier` simple (función global sin receptor). Se devuelve tal
        cual aparece ("Struct::metodo" o "funcion"), sin transformar `::`.
    """
    calls: list[str] = []

    def _visit(node):
        if node.type == "call_expression":
            func_node = node.child_by_field_name("function")
            if func_node is not None:
                if func_node.type == "field_expression":
                    receiver = func_node.children[0] if func_node.children else None
                    field_node = func_node.child_by_field_name("field")
                    if receiver is not None and field_node is not None:
                        calls.append(
                            f"{_node_text(receiver, source)}.{_node_text(field_node, source)}"
                        )
                elif func_node.type in ("scoped_identifier", "identifier"):
                    calls.append(_node_text(func_node, source))
        for child in node.children:
            _visit(child)

    _visit(body_node)
    return calls


# ── Resolución de Invocations ──
#
# `calls` (ver _extract_call_names) captura el TEXTO crudo de cada llamada:
# "funcion" (global, sin receptor), "self.metodo", "obj.metodo",
# "Struct::metodo" (ruta asociada/estática, separador `::`). Esta sección
# resuelve ese texto contra las funciones/métodos conocidos del PROPIO
# archivo, produciendo el arreglo "invocations". Llamadas a símbolos
# externos (imports `use`, crates, receptores de tipo desconocido)
# requerirían inferencia de tipos — fuera del alcance de un parser de un
# solo archivo — y se omiten en vez de adivinar.

def _build_call_index(
    classes: list[dict[str, Any]], functions: list[dict[str, Any]]
) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """
    Construye índices para resolver llamadas dentro del archivo:

    - `by_simple_name`: nombre simple -> id calificado, para funciones
      globales y métodos. Si el mismo nombre existe en varios lugares, se
      queda con el último visto — sin inferencia de tipos no hay forma de
      saber a cuál pertenece un receptor de tipo desconocido.
    - `methods_by_struct`: nombre de struct -> {nombre_metodo: id}, para
      resolver `self.metodo` (receptor conocido) y `Struct::metodo` (ruta
      asociada explícita).
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
    by_simple_name: dict[str, str],
    methods_by_struct: dict[str, dict[str, str]],
) -> str | None:
    """
    Intenta resolver el texto de una llamada a un id calificado del archivo.

    Casos manejados, en orden:
      1. `Struct::metodo(...)` (contiene `::`): ruta asociada/estática
         explícita — se resuelve contra `methods_by_struct[Struct]`.
      2. `self.metodo(...)`: se resuelve contra los métodos del propio
         struct del caller (receptor conocido).
      3. `obj.metodo(...)` con receptor distinto de `self`: el tipo de
         `obj` es desconocido sin inferencia de tipos — no se resuelve.
      4. `funcion(...)` sin receptor (sin `.` ni `::`): función global,
         resuelta contra `by_simple_name`.
      5. Cualquier otro caso: no se resuelve — se devuelve None y el
         caller la descarta.
    """
    if "::" in call_text:
        struct_name, method_name = call_text.rsplit("::", 1)
        return methods_by_struct.get(struct_name, {}).get(method_name)

    if "." in call_text:
        receiver, method_name = call_text.split(".", 1)
        if receiver == "self" and caller_struct is not None:
            return methods_by_struct.get(caller_struct, {}).get(method_name)
        return None  # receptor de tipo desconocido: no se adivina.

    return by_simple_name.get(call_text)


def _extract_invocations(
    classes: list[dict[str, Any]], functions: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Construye el grafo de invocaciones (función/método -> función/método)
    dentro del propio archivo, a partir de los `calls` ya extraídos por
    `_extract_classes_and_structures` / `_extract_global_functions`.

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

    def _accumulate(source_id: str, caller_struct: str | None, calls: list[str]):
        for call_text in calls:
            target_id = _resolve_call_target(
                call_text, caller_struct, by_simple_name, methods_by_struct
            )
            if target_id is None or target_id == source_id:
                continue  # No resuelto, o recursión directa (se omite).
            key = (source_id, target_id)
            weights[key] = weights.get(key, 0) + 1

    for fn in functions:
        _accumulate(fn["id"], None, fn.get("calls", []))

    for cls in classes:
        struct_name = cls["name"]
        for m in cls.get("methods", []):
            m_id = m.get("id")
            if not m_id:
                continue
            _accumulate(m_id, struct_name, m.get("calls", []))

    return [
        {"source": src, "target": tgt, "kind": "call", "weight": w}
        for (src, tgt), w in weights.items()
    ]


# ── Detección de Llamadas HTTP Externas ──

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas en Rust (reqwest, hyper)."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "call_expression":
            func_node = node.child_by_field_name("function")
            if func_node:
                func_text = _node_text(func_node, source)
                if any(
                    kw in func_text
                    for kw in ("reqwest::", "Client::new", "hyper::Client")
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


# ── Función Principal de Parseo Rust ──

def parse_rust_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Rust, extrayendo structs, traits, impls,
    funciones globales, imports, llamadas externas y métricas de complejidad/cohesión.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    imports_data = _extract_imports(root, source)
    classes = _extract_classes_and_structures(root, source, module_id)
    global_functions = _extract_global_functions(root, source, module_id)
    external_calls = _detect_external_calls(root, source, module_id)
    invocations = _extract_invocations(classes, global_functions)

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
            "language": "rust",
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

def parse_rust(file_path: str) -> dict[str, Any]:
    """Wrapper standalone que crea el parser y parsea el archivo."""
    from tree_sitter_language_pack import get_parser
    parser = get_parser("rust")
    with open(file_path, "rb") as f:
        source = f.read()
    tree = parser.parse(source)
    return parse_rust_file(file_path, tree, source)