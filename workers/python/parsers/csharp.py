"""
parsers/csharp.py — Parser AST detallado para archivos C#.

Usa tree-sitter (tree-sitter-c-sharp) para extraer imports (using),
clases/interfaces/records/structs, métodos/constructores/propiedades,
atributos y calcular métricas locales.

Basado en el research de Fase 1 de C# (volcados de AST verificados). Los
puntos donde la gramática de C# diverge de Java quedan documentados en
línea, ya que varios de estos casos son genuinamente distintos y no se
completan por analogía sin haber sido probados contra el AST real:

  - using: qualified_name es recursivo con campos qualifier/name (igual
    forma que Java), pero `using Alias = X.Y` es un caso propio con campo
    `name` para el alias, y `using static` / `global using` son
    modificadores por posición (token suelto), sin field name — igual
    patrón que `import static` de Java.
  - Herencia/interfaces: `base_list` MEZCLA superclase e interfaces, igual
    que Kotlin, pero SIN ninguna marca sintáctica que distinga cuál es la
    superclase (a diferencia de Kotlin, donde la superclase se reconoce
    por su invocación de constructor). La única señal es la CONVENCIÓN de
    C# de que la superclase (si existe) va primera en la lista — no es
    verificable por el AST, así que se trata como heurística explícita,
    no como certeza.
  - Atributos [Attribute]: son hijos directos de la declaración de clase,
    en la misma posición que `modifier` — mismo patrón "no envolvente" que
    Java/Kotlin, no hay riesgo de perder clases con atributos.
  - record_declaration y struct_declaration son tipos de nodo separados de
    class_declaration (a diferencia de Kotlin, donde `data class` es un
    modificador). record puede terminar en `;` sin body (forma posicional
    de una sola línea con parameter_list propio, tipo constructor primario
    de Kotlin).
  - property_declaration es un CUARTO tipo de miembro de clase (además de
    field_declaration, method_declaration, constructor_declaration), con
    su propio accessor_list para get/set — patrón extremadamente común en
    C# idiomático, más que campos públicos directos.
  - params (variádico): token suelto antes del tipo, sin envolver —
    intermedio entre spread_parameter de Java y parameter_modifiers de
    Kotlin. ref/out: campo `modifier` DENTRO del propio parameter, nuevo
    respecto a Java/Kotlin/Python.
  - Control flow: binary_expression + campo `operator` explícito, idéntico
    a Java para &&/||. switch_section usa case/default como primer hijo,
    mismo criterio posicional que switch_label de Java (ver
    metrics/complexity.py CSHARP_COMPLEXITY_CONFIG).
"""

from __future__ import annotations

import math
import os
from typing import Any

from metrics.complexity import cyclomatic_complexity, cognitive_complexity, CSHARP_COMPLEXITY_CONFIG
from metrics.cohesion import calculate_class_metrics


# ── Tipos primitivos de C# ──
#
# cohesion.py.calculate_class_metrics NO acepta un set de primitivos
# inyectable por lenguaje: filtra CBO contra un set fijo con nombres estilo
# Python ("str", "int", "float", "bool", "None", "any"). Para que el CBO de
# C# no cuente `int`, `bool`, `void`, etc. como "tipos referenciados"
# (dependencias de clase), se normalizan los tipos primitivos de C# a esos
# mismos nombres antes de construir attributes/parameters. Esta es la misma
# limitación que arrastra silenciosamente java.py (boolean/long/double de
# Java tampoco se filtran ahí) — aquí se resuelve explícitamente en vez de
# heredar el problema en silencio.
_CSHARP_TO_GENERIC_PRIMITIVE = {
    "int": "int", "uint": "int", "long": "int", "ulong": "int",
    "short": "int", "ushort": "int", "byte": "int", "sbyte": "int",
    "float": "float", "double": "float", "decimal": "float",
    "bool": "bool",
    "string": "str", "char": "str",
    "void": "None",
    "object": "any", "var": "any", "dynamic": "any",
}


def _normalize_type(type_str: str) -> str:
    """
    Normaliza un tipo de C# a su equivalente genérico para que el filtro
    de primitivos de calculate_class_metrics lo reconozca. Tipos no
    primitivos (nombres de clase, genéricos como List<T>, etc.) se dejan
    tal cual — CBO debe seguir contándolos como dependencia real.
    """
    base = type_str.rstrip("?").strip()  # tipos nullable: int? -> int
    return _CSHARP_TO_GENERIC_PRIMITIVE.get(base, type_str)


# ── Extracción de Imports (using) ──

def _extract_imports(root, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae los `using` de nivel de archivo. Cubre using simple, using
    static, global using y using de alias (`using Alias = X.Y`).

    Verificado en research: qualified_name es recursivo (campos
    qualifier/name), igual patrón que Java pero con field names explícitos
    (más cómodo de recorrer que scoped_identifier de Java). `using static`
    y `global using` son modificadores por posición (token suelto antes
    del qualified_name), sin field name propio.
    """
    imports: list[dict[str, Any]] = []

    for child in root.children:
        if child.type == "using_directive":
            is_static = False
            is_global = False
            alias: str | None = None
            module_name = ""

            alias_node = child.child_by_field_name("name")
            if alias_node:
                alias = _node_text(alias_node, source)

            for sub in child.children:
                if sub.type == "static":
                    is_static = True
                elif sub.type == "global":
                    is_global = True
                elif sub.type in ("qualified_name", "identifier"):
                    if alias_node and sub == alias_node:
                        continue
                    module_name = _node_text(sub, source)

            if module_name:
                imports.append({
                    "module": module_name,
                    "isStatic": is_static,
                    "isWildcard": False,  # C# no tiene wildcard de import tipo Java .*
                    "isRelative": False,
                    "isGlobal": is_global,
                    "alias": alias,
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
    """
    Extrae la lista de parámetros de un parameter_list de C#.

    Verificado contra el AST real de tree-sitter-csharp:
      - Parámetros normales: nodos `parameter` con hijos posicionales
        (tipo como predefined_type/identifier/etc., nombre como identifier).
        NO tienen field names "type"/"name" — se extraen por posición.
      - `ref`/`out`/`in`: aparecen como nodos `modifier` DENTRO del
        propio `parameter`.
      - `params` (variádico): NO está dentro de un nodo `parameter`.
        Es un HERMANO a nivel de `parameter_list`, seguido del tipo
        (array_type) y el nombre (identifier), los tres sueltos.
      - Valor por defecto: nodo `=` seguido de una expresión, como
        hermanos dentro del `parameter`.
    """
    params: list[dict[str, Any]] = []
    if params_node is None:
        return params

    children = list(params_node.children)
    i = 0
    while i < len(children):
        child = children[i]

        if child.type in ("(", ")", ","):
            i += 1
            continue

        # --- Caso especial: `params` variádico ---
        # `params string[] list` se serializa como tres hermanos sueltos
        # a nivel de parameter_list: `params`, tipo (array_type), identifier.
        if child.type == "params":
            param_type = "any"
            param_name = ""
            # Siguiente hermano: el tipo
            if i + 1 < len(children):
                param_type = _normalize_type(_node_text(children[i + 1], source))
            # Siguiente después del tipo: el nombre
            if i + 2 < len(children) and children[i + 2].type == "identifier":
                param_name = _node_text(children[i + 2], source)
            if param_name:
                params.append({
                    "name": param_name,
                    "type": param_type,
                    "isOptional": False,
                    "isVariadic": True,
                })
            i += 3  # saltar params + tipo + nombre
            continue

        if child.type != "parameter":
            i += 1
            continue

        # --- Parámetro normal ---
        param: dict[str, Any] = {
            "name": "",
            "type": "any",
            "isOptional": False,
            "isVariadic": False,
        }

        ref_kind: str | None = None
        for sub in child.children:
            if sub.type == "modifier":
                # ref/out/in viven como modifier > keyword
                for mod_child in sub.children:
                    if mod_child.type in ("ref", "out", "in"):
                        ref_kind = mod_child.type
            elif sub.type == "identifier":
                # El último identifier es el nombre; los anteriores podrían
                # ser el tipo (si es un tipo no-primitivo). Pero el tipo
                # generalmente es predefined_type/generic_name/etc., no
                # identifier, así que se toma el último identifier como nombre.
                param["name"] = _node_text(sub, source)
            elif sub.type in ("predefined_type", "generic_name",
                              "qualified_name", "array_type",
                              "nullable_type"):
                param["type"] = _normalize_type(_node_text(sub, source))
            elif sub.type == "=":
                param["isOptional"] = True

        if ref_kind:
            param["refKind"] = ref_kind

        if param["name"]:
            params.append(param)

        i += 1

    return params


# ── Extractor de Atributos de Instancia C# para LCOM4 ──

def make_csharp_attribute_extractor(field_names: set[str]) -> Any:
    """
    Construye una función para extraer atributos de instancia accedidos
    dentro de un método/propiedad, usando el conjunto de campos conocidos
    de la clase para evitar falsos positivos con variables locales.

    NOTA: a diferencia de Java (verificado: `field_access` con hijos
    posicionales [object, '.', field]), el research de C# no volcó
    explícitamente la forma del nodo de acceso a miembro con receptor
    explícito (`this.x`). tree-sitter-c-sharp usa convencionalmente
    `member_access_expression` con campos NOMBRADOS `expression`/`name`
    (no posicional como Java) — se implementa aquí bajo ese supuesto
    estándar de la gramática, pero queda marcado como PENDIENTE DE
    VERIFICAR contra un volcado de AST real antes de confiar en él para
    código de producción, tal como se hizo para cada uno de los otros
    hallazgos de este research.
    """
    def extract_csharp_attributes(body_node) -> set[str]:
        attrs: set[str] = set()

        def _visit(node):
            if node.type == "member_access_expression":
                # this.x — PENDIENTE DE VERIFICAR forma exacta del nodo.
                expr = node.child_by_field_name("expression")
                name_n = node.child_by_field_name("name")
                if expr is not None and name_n is not None and expr.text == b"this":
                    attrs.add(name_n.text.decode("utf-8", errors="replace"))
            elif node.type == "identifier":
                # Acceso implícito a campo sin 'this.' — extremadamente
                # común en C#. Solo cuenta si coincide con un campo
                # declarado en la clase, igual criterio que Java.
                name = node.text.decode("utf-8", errors="replace")
                if name in field_names:
                    parent = node.parent
                    if parent is not None:
                        if parent.type == "variable_declarator" and parent.child_by_field_name("name") == node:
                            pass
                        elif parent.type == "parameter" and parent.child_by_field_name("name") == node:
                            pass
                        elif parent.type == "member_access_expression" and parent.child_by_field_name("name") == node:
                            # Ya manejado por el caso member_access_expression principal.
                            pass
                        else:
                            attrs.add(name)
                    else:
                        attrs.add(name)

            for child in node.children:
                _visit(child)

        _visit(body_node)
        return attrs

    return extract_csharp_attributes


# ── Modificadores, Visibilidad y Atributos [Attribute] ──

def _parse_modifiers(node, source: bytes) -> tuple[str, bool, bool, list[str]]:
    """
    Parsea los modificadores y atributos [Attribute] de una declaración de
    C#. Verificado contra el AST real: los modificadores de visibilidad
    (public, private, etc.) y otros (static, abstract, readonly, async)
    están envueltos en nodos `modifier`, NO como tokens directos. Los
    atributos ([Serializable], etc.) sí son hijos directos como
    `attribute_list`.
    """
    visibility = "internal"  # default de C# a nivel de tipo top-level
    is_static = False
    is_abstract = False
    decorators: list[str] = []

    for child in node.children:
        if child.type == "modifier":
            # Cada `modifier` envuelve exactamente un token keyword.
            for mod_child in child.children:
                if mod_child.type == "public":
                    visibility = "public"
                elif mod_child.type == "private":
                    visibility = "private"
                elif mod_child.type == "protected":
                    visibility = "protected"
                elif mod_child.type == "internal":
                    visibility = "internal"
                elif mod_child.type == "static":
                    is_static = True
                elif mod_child.type == "abstract":
                    is_abstract = True
        elif child.type == "attribute_list":
            for attr in child.children:
                if attr.type == "attribute":
                    name_n = attr.child_by_field_name("name")
                    if name_n:
                        decorators.append(_node_text(name_n, source))

    return visibility, is_static, is_abstract, decorators


# ── Extracción de Clases, Interfaces, Records y Structs ──

def _extract_classes_and_structures(
    root, source: bytes, module_id: str
) -> list[dict[str, Any]]:
    """
    Extrae clases, interfaces, structs y records del archivo C#, incluyendo
    tipos anidados recursivamente.

    Verificado en research:
      - record_declaration y struct_declaration son tipos de nodo propios,
        distintos de class_declaration.
      - base_list mezcla superclase e interfaces sin distinción sintáctica.
        Se aplica la convención de C# (superclase, si existe, va primera)
        como heurística explícita: si el primer elemento de base_list NO
        empieza con 'I' + mayúscula (convención de nombres de interfaz en
        C#, no garantía), se asume superclase; en cualquier otro caso todo
        base_list se trata como implements. Esta heurística puede
        equivocarse — no hay forma de que el AST lo confirme — así que se
        documenta explícitamente en vez de presentarla como certeza.
    """
    classes: list[dict[str, Any]] = []

    def _traverse(node, parent_class_name: str | None = None):
        is_class = node.type == "class_declaration"
        is_interface = node.type == "interface_declaration"
        is_struct = node.type == "struct_declaration"
        is_record = node.type == "record_declaration"

        if is_class or is_interface or is_struct or is_record:
            name_node = node.child_by_field_name("name")
            raw_name = _node_text(name_node, source) if name_node else "Anonymous"
            name = f"{parent_class_name}.{raw_name}" if parent_class_name else raw_name

            visibility, is_static, is_abstract, decorators = _parse_modifiers(node, source)

            if is_interface:
                is_abstract = True

            # base_list: superclase + interfaces mezcladas, sin marca.
            # Verificado: NO tiene field name "bases" — se busca por tipo.
            extends: list[str] = []
            implements: list[str] = []
            base_list_node = _child_by_type(node, "base_list")
            if base_list_node:
                base_names: list[str] = []
                for sub in base_list_node.children:
                    if sub.type in ("identifier", "generic_name", "qualified_name"):
                        base_names.append(_node_text(sub, source))

                if base_names and not is_interface:
                    # Heurística de convención C#: si el primer elemento NO
                    # sigue el patrón de nombre de interfaz ("I" + mayúscula),
                    # se asume que es la superclase. No verificable por AST.
                    first = base_names[0]
                    looks_like_interface = len(first) >= 2 and first[0] == "I" and first[1].isupper()
                    if not looks_like_interface:
                        extends.append(first)
                        implements.extend(base_names[1:])
                    else:
                        implements.extend(base_names)
                else:
                    implements.extend(base_names)

            body_node = node.child_by_field_name("body")
            methods, method_bodies, attributes = _extract_members(
                body_node, source, module_id, name, is_interface
            )

            # record posicional de una sola línea: parameter_list propio a
            # nivel de declaración. Verificado: record_declaration NO tiene
            # field name "parameters" — se busca por tipo de nodo.
            params_node = _child_by_type(node, "parameter_list")
            if is_record and params_node is not None:
                for p in _extract_parameters(params_node, source):
                    attributes.append({
                        "name": p["name"],
                        "type": p["type"],
                        "visibility": "public",
                        "isStatic": False,
                        "isReadonly": True,  # record positional params son init-only
                    })

            field_names = {attr["name"] for attr in attributes}
            extract_attrs_fn = make_csharp_attribute_extractor(field_names)
            # Constructor en C# se llama igual que la clase (como Java),
            # no "__init__" — se excluye por nombre real para evitar el
            # "efecto puente" documentado en cohesion.py.
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
                "isRecord": is_record,
                "isStruct": is_struct,
                "visibility": visibility,
                "methods": methods,
                "attributes": attributes,
                "extends": extends,
                "implements": implements,
                "decorators": decorators,
                "metrics": metrics,
            })

            if body_node:
                for child in body_node.children:
                    _traverse(child, name)
        else:
            for child in node.children:
                _traverse(child, parent_class_name)

    _traverse(root)
    return classes


# ── Extracción de Miembros (métodos, constructores, propiedades, campos) ──

def _extract_members(
    body_node, source: bytes, module_id: str, class_name: str, is_interface: bool
) -> tuple[list[dict], list, list[dict]]:
    """
    Extrae métodos, constructores, propiedades y campos de un cuerpo de
    clase/interfaz/struct/record.

    Verificado en research: property_declaration es un CUARTO tipo de
    miembro, distinto de field_declaration y method_declaration, con su
    propio accessor_list (get/set) — patrón más común en C# idiomático que
    los campos públicos directos. Se modela como AttributeInfo (conceptual
    mente es un atributo de la clase), marcando isReadonly=True si solo
    tiene accessor `get` (sin `set`).
    """
    methods: list[dict[str, Any]] = []
    method_bodies: list = []
    attributes: list[dict[str, Any]] = []

    if body_node is None:
        return methods, method_bodies, attributes

    for child in body_node.children:
        is_method = child.type == "method_declaration"
        is_constructor = child.type == "constructor_declaration"

        if is_method or is_constructor:
            name_node = child.child_by_field_name("name")
            name = _node_text(name_node, source) if name_node else "anonymous"

            params_node = child.child_by_field_name("parameters")
            params = _extract_parameters(params_node, source)

            ret_type = "void"
            if is_method:
                # Verificado: el campo se llama "returns", no "type".
                type_node = child.child_by_field_name("returns")
                if type_node:
                    ret_type = _normalize_type(_node_text(type_node, source))
            else:
                ret_type = class_name.split(".")[-1]

            visibility, is_static, is_abstract, decorators = _parse_modifiers(child, source)

            if is_interface and not is_abstract:
                # En interfaces de C#, un método sin body es implícitamente
                # abstracto (igual que Java); si tiene body (default
                # interface methods, C# 8+), no lo es.
                body_check = child.child_by_field_name("body")
                is_abstract = body_check is None

            body = child.child_by_field_name("body")
            cc = cyclomatic_complexity(body, CSHARP_COMPLEXITY_CONFIG) if body else 1
            cog = cognitive_complexity(body, CSHARP_COMPLEXITY_CONFIG) if body else 0
            loc = body.end_point[0] - body.start_point[0] + 1 if body else 1

            methods.append({
                "name": name,
                "visibility": visibility,
                "isStatic": is_static,
                "isAbstract": is_abstract,
                "isAsync": False,  # TODO: detectar modifier 'async' si el proyecto lo requiere
                "isConstructor": is_constructor,
                "parameters": params,
                "returnType": ret_type,
                "cyclomaticComplexity": cc,
                "cognitiveComplexity": cog,
                "loc": loc,
                "decorators": decorators,
            })
            method_bodies.append(body)

        elif child.type == "field_declaration":
            # Verificado: field_declaration NO tiene field names para
            # tipo/nombre. El tipo está dentro de variable_declaration
            # como primer hijo tipado (predefined_type, identifier, etc.).
            # readonly es un nodo modifier, no un token directo.
            visibility, is_static, _, _ = _parse_modifiers(child, source)
            is_readonly = any(
                sub.type == "modifier" and any(
                    mc.type == "readonly" for mc in sub.children
                )
                for sub in child.children
            )

            for sub in child.children:
                if sub.type == "variable_declaration":
                    # El tipo es el primer hijo tipado de variable_declaration.
                    t_str = "any"
                    for vd_child in sub.children:
                        if vd_child.type in ("predefined_type", "identifier",
                                             "generic_name", "qualified_name",
                                             "array_type", "nullable_type"):
                            t_str = _normalize_type(_node_text(vd_child, source))
                            break
                    for decl in sub.children:
                        if decl.type == "variable_declarator":
                            # El nombre del variable_declarator es su primer
                            # hijo identifier (sin field name en esta gramática).
                            vd_name = None
                            for vd_sub in decl.children:
                                if vd_sub.type == "identifier":
                                    vd_name = _node_text(vd_sub, source)
                                    break
                            if vd_name:
                                attributes.append({
                                    "name": vd_name,
                                    "type": t_str,
                                    "visibility": visibility,
                                    "isStatic": is_static,
                                    "isReadonly": is_readonly,
                                })

        elif child.type == "property_declaration":
            # public int X { get; set; } — cuarto tipo de miembro.
            # Verificado: tiene field names "name" y "type" funcionales,
            # y "accessors" para el accessor_list.
            type_node = child.child_by_field_name("type")
            t_str = _normalize_type(_node_text(type_node, source)) if type_node else "any"
            name_node = child.child_by_field_name("name")
            prop_name = _node_text(name_node, source) if name_node else "unknown"

            visibility, is_static, _, decorators = _parse_modifiers(child, source)

            accessor_list = child.child_by_field_name("accessors") or _child_by_type(child, "accessor_list")
            has_setter = False
            if accessor_list:
                for acc in accessor_list.children:
                    if acc.type == "accessor_declaration":
                        # Verificado: primer hijo real es get/set directamente.
                        for acc_child in acc.children:
                            if acc_child.type == "set":
                                has_setter = True
                                break

            attributes.append({
                "name": prop_name,
                "type": t_str,
                "visibility": visibility,
                "isStatic": is_static,
                "isReadonly": not has_setter,
            })

    return methods, method_bodies, attributes


# ── Detección de Llamadas HTTP Externas ──

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """Detecta llamadas HTTP conocidas (HttpClient, RestClient) por nombre de método invocado."""
    calls: list[dict[str, Any]] = []

    def _visit(node):
        if node.type == "invocation_expression":
            func_node = node.child_by_field_name("function")
            name_str = ""
            obj_str = ""
            if func_node is not None:
                if func_node.type == "member_access_expression":
                    name_n = func_node.child_by_field_name("name")
                    expr_n = func_node.child_by_field_name("expression")
                    name_str = _node_text(name_n, source) if name_n else ""
                    obj_str = _node_text(expr_n, source) if expr_n else ""
                elif func_node.type == "identifier":
                    name_str = _node_text(func_node, source)

            if name_str in ("GetAsync", "PostAsync", "PutAsync", "DeleteAsync", "SendAsync", "Send"):
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


# ── Función Principal de Parseo C# ──

def parse_csharp_file(
    file_path: str,
    tree,
    source: bytes,
) -> dict[str, Any]:
    """
    Parseo detallado de un archivo C#, extrayendo tipos, miembros, using y
    llamadas externas, y calculando sus métricas.
    """
    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    imports_data = _extract_imports(root, source)
    classes = _extract_classes_and_structures(root, source, module_id)
    external_calls = _detect_external_calls(root, source, module_id)

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
            "language": "csharp",
            "loc": loc,
            "lloc": lloc,
            "classes": classes,
            "functions": [],  # C# no tiene funciones globales de primer nivel (fuera de top-level statements)
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