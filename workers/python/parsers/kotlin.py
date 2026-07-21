"""
parsers/kotlin.py — Extractor AST detallado para archivos Kotlin (.kt, .kts).

Todas las decisiones de este módulo están respaldadas por hallazgos-kotlin.md
(Fase 1, validada contra tree-sitter-kotlin real). Diferencias clave respecto
a parsers/python.py y parsers/java.py que motivan un módulo propio en vez de
reutilizar alguno de los dos tal cual:

  - Kotlin tiene TRES tipos de nodo de "clase": `class_declaration`,
    `object_declaration` (singleton) y `companion_object` (miembros
    estáticos) — no uno solo como Python/Java.
  - El constructor primario (`primary_constructor`) mezcla parámetros de
    constructor y declaración de atributos de instancia en el mismo nodo
    `class_parameter`: `class Point(val x: Int)` hace que `x` sea AMBAS
    cosas simultáneamente cuando lleva `val`/`var`.
  - Herencia vs. implementación de interfaces NO están en campos separados
    (a diferencia de Java): ambas viven en `delegation_specifiers`, y se
    distinguen por inferencia — `constructor_invocation` (con paréntesis
    de llamada) es la superclase real; `user_type` sin invocación es una
    interfaz.
  - `&&`/`||` sí comparten el mismo criterio que Java (`binary_expression`
    + campo `operator` explícito), así que la configuración de complejidad
    se reutiliza sin cambios respecto a JAVA_COMPLEXITY_CONFIG.
"""

from __future__ import annotations

from typing import Any


# ─────────────────────────────────────────────────────────────────────────
# Imports
# ─────────────────────────────────────────────────────────────────────────


def _node_text(node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _extract_imports(root, source: bytes) -> list[dict[str, Any]]:
    """
    Recorre los nodos `import` del árbol. Verificado (hallazgos-kotlin.md
    §1): ningún hijo de `import` tiene field name — se dispatcha por tipo
    de nodo y posición, igual que en Java. Sin imports relativos ni
    múltiples símbolos por línea (cada `import` trae exactamente un
    símbolo o un wildcard de paquete).
    """
    imports: list[dict[str, Any]] = []

    def visit(node):
        # El nodo contenedor `import` (is_named=True) tiene como PRIMER HIJO
        # un token literal también llamado "import" (is_named=False, la
        # palabra clave en sí). Sin filtrar por is_named, ambos se cuentan
        # como si fueran declaraciones de import, produciendo entradas
        # duplicadas/vacías ("<desconocido>") — confirmado al ejecutar
        # contra la gramática real, no era evidente solo leyendo el código.
        if node.type == "import" and node.is_named:
            imports.append(_extract_import(node, source))
        for child in node.children:
            visit(child)

    visit(root)
    return imports


def _extract_import(node, source: bytes) -> dict[str, Any]:
    """
    import java.util.List              -> source="java.util.List"
    import java.util.*                 -> source="java.util", isWildcard=True
    import java.io.File as MyFile      -> source="java.io.File", importedNames=["MyFile"]

    `qualified_identifier` es PLANO en Kotlin (lista de `identifier`
    hermanos), a diferencia del `scoped_identifier` recursivo de Java —
    tomar el texto completo del nodo alcanza sin reconstruir manualmente.
    """
    qualified_id = None
    is_wildcard = False
    alias = None
    saw_as = False

    for child in node.children:
        if child.type == "qualified_identifier":
            qualified_id = _node_text(child, source)
        elif child.type == "*":
            is_wildcard = True
        elif child.type == "as":
            saw_as = True
        elif child.type == "identifier" and saw_as:
            alias = _node_text(child, source)

    source_str = qualified_id or "<desconocido>"

    # El wildcard indica que qualified_identifier ya es el paquete (sin la
    # clase final); para el import con nombre simple, qualified_identifier
    # incluye el símbolo importado completo. Se reporta tal cual sin
    # intentar separar "paquete" de "símbolo" aquí — esa resolución de
    # dependencias locales se hace en una capa posterior, igual que se
    # decidió para Java (sin imports relativos que resolver en Kotlin).
    imported_names: list[str] = []
    if alias:
        imported_names.append(alias)

    return {
        "source": source_str,
        "importedNames": imported_names,
        "isWildcard": is_wildcard,
    }


# ─────────────────────────────────────────────────────────────────────────
# Modificadores / anotaciones (compartido entre clases, objects, funciones
# y class_parameter individuales — todos usan el mismo patrón de `modifiers`)
# ─────────────────────────────────────────────────────────────────────────

_VISIBILITY_MODIFIERS = frozenset({"public", "private", "protected", "internal"})

# Modificadores de clase que indican "no se puede heredar de esto" o
# similar — no afectan visibilidad pero sí son relevantes para reportar
# junto con la clase (ej. para ModuleType en una fase futura).
_KNOWN_CLASS_MODIFIER_TOKENS = frozenset({
    "data", "sealed", "abstract", "open", "final", "inner", "enum", "annotation",
})


def _extract_modifiers_and_annotations(node) -> tuple[list[str], str]:
    """
    Dado cualquier nodo que pueda tener un hijo `modifiers` (class_declaration,
    object_declaration, function_declaration, class_parameter, etc.), separa
    las anotaciones (`@Entity`, `@Inject`, ...) de los modificadores de
    visibilidad/otros. Verificado (hallazgos-kotlin.md §2): las anotaciones
    viven DENTRO de `modifiers`, sin envoltorio tipo decorated_definition de
    Python — no hay riesgo de "perder" nodos anotados con una búsqueda
    directa del tipo de nodo principal.

    Returns:
        (decorators, visibility) — decorators es la lista de nombres de
        anotación (sin el '@'); visibility es "public" por defecto si no
        se encuentra un modificador de visibilidad explícito (Kotlin trata
        la ausencia de modificador como público, a diferencia de Python
        donde se infiere por convención de guion bajo).
    """
    decorators: list[str] = []
    visibility = "public"

    modifiers_node = None
    for child in node.children:
        if child.type == "modifiers":
            modifiers_node = child
            break

    if modifiers_node is None:
        return decorators, visibility

    def visit(n):
        nonlocal visibility
        if n.type == "annotation":
            name = _extract_annotation_name(n)
            if name:
                decorators.append(name)
        elif n.type in _VISIBILITY_MODIFIERS:
            visibility = n.type
        for child in n.children:
            visit(child)

    visit(modifiers_node)
    return decorators, visibility


def _extract_annotation_name(annotation_node) -> str | None:
    """
    `@Entity` -> user_type(Entity) hijo directo.
    `@Table(name = "users")` -> constructor_invocation hijo, con user_type anidado.
    Ambos casos verificados en hallazgos-kotlin.md §2/§Anotaciones.
    """
    for child in annotation_node.children:
        if child.type == "user_type":
            ident = _first_named_child(child, "identifier")
            if ident is not None:
                return ident.text.decode("utf-8", errors="replace")
        elif child.type == "constructor_invocation":
            user_type = _first_named_child(child, "user_type")
            if user_type is not None:
                ident = _first_named_child(user_type, "identifier")
                if ident is not None:
                    return ident.text.decode("utf-8", errors="replace")
    return None


def _first_named_child(node, type_name: str):
    for child in node.children:
        if child.type == type_name:
            return child
    return None


def _has_modifier_token(node, token_type: str) -> bool:
    """
    Verifica si `node` tiene un hijo `modifiers` que contenga, en cualquier
    profundidad, un token/nodo del tipo dado (p. ej. buscar "data" dentro
    de class_modifier, o "suspend" dentro de function_modifier).
    """
    for child in node.children:
        if child.type == "modifiers":
            found = [False]

            def visit(n):
                if n.type == token_type:
                    found[0] = True
                for c in n.children:
                    visit(c)

            visit(child)
            return found[0]
    return False


def _extract_parameters(params_node) -> list[dict[str, Any]]:
    """
    Extrae parámetros de `function_value_parameters`. Verificado
    (hallazgos-kotlin.md §3): vararg se marca con un nodo hermano
    `parameter_modifiers` ANTES del `parameter` correspondiente, no
    envolviéndolo (a diferencia del `spread_parameter` de Java) — hay que
    mirar el hermano anterior, no la forma del parámetro mismo.

    Valor por defecto (`x: Int = 5`): verificado contra el AST real que el
    token `=` y el valor NO son hijos del nodo `parameter` — son HERMANOS
    del `parameter` dentro de `function_value_parameters`, al mismo nivel
    que los paréntesis. Una primera versión que solo miraba dentro de
    `parameter` nunca detectaba los defaults; se corrigió mirando el
    siguiente hermano tras cada `parameter`.
    """
    if params_node is None:
        return []

    result: list[dict[str, Any]] = []
    pending_is_variadic = False
    children = list(params_node.children)

    for i, child in enumerate(children):
        if child.type == "parameter_modifiers":
            pending_is_variadic = _contains_token(child, "vararg")
        elif child.type == "parameter":
            name_node = _first_named_child(child, "identifier")
            type_node = _first_named_child(child, "user_type")

            has_default = (
                i + 1 < len(children) and children[i + 1].type == "="
            )

            result.append({
                "name": name_node.text.decode("utf-8") if name_node else "<desconocido>",
                "type": type_node.text.decode("utf-8", errors="replace") if type_node else "Any",
                "hasDefault": has_default,
                "isVariadic": pending_is_variadic,
            })
            pending_is_variadic = False

    return result


def _contains_token(node, token_type: str) -> bool:
    if node.type == token_type:
        return True
    for child in node.children:
        if _contains_token(child, token_type):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────
# Clases / objects / companion objects
# ─────────────────────────────────────────────────────────────────────────

_CLASS_LIKE_TYPES = frozenset({"class_declaration", "object_declaration"})


def _extract_classes(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """
    Busca los 3 tipos de nodo de "clase" en Kotlin (hallazgos-kotlin.md §0):
    class_declaration, object_declaration (singleton) y companion_object
    (miembros estáticos, siempre anidado dentro de un class_body). Cada uno
    se recorre con su propio extractor porque su forma difiere: object_declaration
    y companion_object no tienen constructor primario ni herencia real (un
    object puede implementar interfaces vía delegation_specifiers, pero
    nunca extiende una clase con parámetros propios).
    """
    classes: list[dict[str, Any]] = []

    def visit(node, enclosing_class_name: str | None = None):
        if node.type == "class_declaration":
            classes.append(_extract_class_declaration(node, source, module_id))
            body = node.child_by_field_name("body") or _first_named_child(node, "class_body")
            if body is not None:
                for child in body.children:
                    if child.type == "companion_object":
                        classes.append(_extract_companion_object(child, source, module_id))
                    else:
                        visit(child, enclosing_class_name)
            return
        elif node.type == "object_declaration":
            classes.append(_extract_object_declaration(node, source, module_id))
            return

        for child in node.children:
            visit(child, enclosing_class_name)

    visit(root)
    return classes


def _extract_class_declaration(node, source: bytes, module_id: str) -> dict[str, Any]:
    name_node = node.child_by_field_name("name") or _first_named_child(node, "identifier")
    name = name_node.text.decode("utf-8") if name_node else "<anonima>"

    decorators, visibility = _extract_modifiers_and_annotations(node)
    is_data_class = _has_modifier_token(node, "data")

    primary_ctor = _first_named_child(node, "primary_constructor")
    ctor_params, ctor_attrs = _extract_primary_constructor(primary_ctor, source)

    extends, implements = _extract_delegation_specifiers(node, source)

    methods: list[dict[str, Any]] = []
    attributes: list[dict[str, Any]] = list(ctor_attrs)
    method_body_nodes: list[Any] = []

    if primary_ctor is not None:
        ctor_loc = primary_ctor.end_point[0] - primary_ctor.start_point[0] + 1
        methods.append({
            "name": name,
            "isConstructor": True,
            "visibility": "public",
            "isStatic": False,
            "isAbstract": False,
            "parameters": ctor_params,
            "returnType": name,
            "cyclomaticComplexity": 1,
            "cognitiveComplexity": 0,
            "loc": ctor_loc,
            "isAsync": False,
            "decorators": [],
        })
        method_body_nodes.append(None)  # el constructor primario no tiene block propio

    class_body = node.child_by_field_name("body") or _first_named_child(node, "class_body")
    if class_body is not None:
        for child in class_body.children:
            if child.type == "function_declaration":
                m, body = _extract_function(child, source)
                methods.append(m)
                method_body_nodes.append(body)
            elif child.type == "property_declaration":
                attr = _extract_property_declaration(child, source)
                if attr is not None:
                    attributes.append(attr)

    return {
        "id": f"{module_id}::{name}",
        "name": name,
        "isAbstract": _has_modifier_token(node, "abstract"),
        "isInterface": False,  # Kotlin interfaces no se detectan todavía — ver nota aparte
        "extends": extends,
        "implements": implements,
        "decorators": decorators,
        "visibility": visibility,
        "isDataClass": is_data_class,
        "isObject": False,
        "methods": methods,
        "attributes": attributes,
        "_methodBodyNodes": method_body_nodes,  # uso interno, no serializar
    }


def _extract_object_declaration(node, source: bytes, module_id: str) -> dict[str, Any]:
    """
    `object Foo { ... }` — singleton. No tiene constructor primario ni
    superclase con parámetros (Kotlin no permite `object Foo(x: Int)`),
    pero sí puede implementar interfaces vía delegation_specifiers.
    """
    name_node = node.child_by_field_name("name") or _first_named_child(node, "identifier")
    name = name_node.text.decode("utf-8") if name_node else "<anonimo>"

    decorators, visibility = _extract_modifiers_and_annotations(node)
    extends, implements = _extract_delegation_specifiers(node, source)

    methods: list[dict[str, Any]] = []
    attributes: list[dict[str, Any]] = []
    method_body_nodes: list[Any] = []

    class_body = node.child_by_field_name("body") or _first_named_child(node, "class_body")
    if class_body is not None:
        for child in class_body.children:
            if child.type == "function_declaration":
                m, body = _extract_function(child, source)
                methods.append(m)
                method_body_nodes.append(body)
            elif child.type == "property_declaration":
                attr = _extract_property_declaration(child, source)
                if attr is not None:
                    attributes.append(attr)

    return {
        "id": f"{module_id}::{name}",
        "name": name,
        "isAbstract": False,
        "isInterface": False,
        "extends": extends,
        "implements": implements,
        "decorators": decorators,
        "visibility": visibility,
        "isDataClass": False,
        "isObject": True,
        "methods": methods,
        "attributes": attributes,
        "_methodBodyNodes": method_body_nodes,
    }


def _extract_companion_object(node, source: bytes, module_id: str) -> dict[str, Any]:
    """
    `companion object { ... }` dentro de una clase — equivalente conceptual
    a miembros estáticos de Java. Se reporta como un ClassInfo separado con
    nombre sintético "Companion" (Kotlin permite nombrarlo explícitamente
    con `companion object Named { ... }`; se usa ese nombre si está
    presente, o "Companion" si es anónimo, que es el caso más común).
    """
    name_node = _first_named_child(node, "identifier")
    name = name_node.text.decode("utf-8") if name_node else "Companion"

    methods: list[dict[str, Any]] = []
    attributes: list[dict[str, Any]] = []
    method_body_nodes: list[Any] = []

    class_body = _first_named_child(node, "class_body")
    if class_body is not None:
        for child in class_body.children:
            if child.type == "function_declaration":
                m, body = _extract_function(child, source)
                methods.append(m)
                method_body_nodes.append(body)
            elif child.type == "property_declaration":
                attr = _extract_property_declaration(child, source)
                if attr is not None:
                    attributes.append(attr)

    return {
        "id": f"{module_id}::{name}",
        "name": name,
        "isAbstract": False,
        "isInterface": False,
        "extends": [],
        "implements": [],
        "decorators": [],
        "visibility": "public",
        "isDataClass": False,
        "isObject": True,  # conceptualmente es un singleton también
        "isCompanion": True,
        "methods": methods,
        "attributes": attributes,
        "_methodBodyNodes": method_body_nodes,
    }


def _extract_primary_constructor(ctor_node, source: bytes) -> tuple[list[dict], list[dict]]:
    """
    Extrae AMBAS representaciones del constructor primario: los parámetros
    del constructor (para MethodInfo) Y los atributos de instancia que
    genera cada `class_parameter` con `val`/`var` (para AttributeInfo).
    Verificado (hallazgos-kotlin.md §2): un class_parameter SIN val/var es
    un parámetro de constructor puro, no un atributo accesible fuera del
    constructor — se excluye de la lista de atributos en ese caso.
    """
    if ctor_node is None:
        return [], []

    params: list[dict[str, Any]] = []
    attributes: list[dict[str, Any]] = []

    class_params = _first_named_child(ctor_node, "class_parameters")
    if class_params is None:
        return params, attributes

    for child in class_params.children:
        if child.type != "class_parameter":
            continue

        name_node = _first_named_child(child, "identifier")
        type_node = _first_named_child(child, "user_type")
        name = name_node.text.decode("utf-8") if name_node else "<desconocido>"
        type_str = type_node.text.decode("utf-8", errors="replace") if type_node else "Any"

        is_val = _contains_direct_token(child, "val")
        is_var = _contains_direct_token(child, "var")

        param_decorators, param_visibility = _extract_modifiers_and_annotations(child)

        params.append({
            "name": name,
            "type": type_str,
            "hasDefault": any(c.type == "=" for c in child.children),
            "isVariadic": False,
        })

        if is_val or is_var:
            attributes.append({
                "name": name,
                "type": type_str,
                "visibility": param_visibility,
                "isStatic": False,
                "isReadonly": is_val,
                "decorators": param_decorators,
            })

    return params, attributes


def _contains_direct_token(node, token_type: str) -> bool:
    """A diferencia de _contains_token, solo mira hijos directos, no recursivo."""
    return any(c.type == token_type for c in node.children)


def _extract_delegation_specifiers(node, source: bytes) -> tuple[list[str], list[str]]:
    """
    Separa superclase (extends) de interfaces (implements) dentro de
    `delegation_specifiers`. Verificado (hallazgos-kotlin.md §2): no hay
    campos separados como en Java — se infiere por la forma del hijo de
    cada delegation_specifier:
      - constructor_invocation (con paréntesis de llamada, ej. Animal(name))
        -> es la superclase real.
      - user_type sin invocación (ej. Comparable<Dog>, Serializable)
        -> es una interfaz implementada.
    """
    extends: list[str] = []
    implements: list[str] = []

    delegation = _first_named_child(node, "delegation_specifiers")
    if delegation is None:
        return extends, implements

    for spec in delegation.children:
        if spec.type != "delegation_specifier":
            continue

        ctor_inv = _first_named_child(spec, "constructor_invocation")
        if ctor_inv is not None:
            user_type = _first_named_child(ctor_inv, "user_type")
            if user_type is not None:
                ident = _first_named_child(user_type, "identifier")
                if ident is not None:
                    extends.append(ident.text.decode("utf-8"))
            continue

        user_type = _first_named_child(spec, "user_type")
        if user_type is not None:
            ident = _first_named_child(user_type, "identifier")
            if ident is not None:
                implements.append(ident.text.decode("utf-8"))

    return extends, implements


def _extract_property_declaration(node, source: bytes) -> dict[str, Any] | None:
    """
    Atributos declarados directamente en el cuerpo de la clase (no en el
    constructor primario), ej. `companion object { const val MAX = 3 }`.
    """
    var_decl = _first_named_child(node, "variable_declaration")
    if var_decl is None:
        return None
    name_node = _first_named_child(var_decl, "identifier")
    if name_node is None:
        return None

    is_val = _contains_direct_token(node, "val")
    decorators, visibility = _extract_modifiers_and_annotations(node)

    return {
        "name": name_node.text.decode("utf-8"),
        "type": "Any",  # el tipo no siempre está anotado explícitamente; se refina si se requiere
        "visibility": visibility,
        "isStatic": False,
        "isReadonly": is_val,
        "decorators": decorators,
    }


# ─────────────────────────────────────────────────────────────────────────
# Funciones / métodos
# ─────────────────────────────────────────────────────────────────────────

from metrics.complexity import (
    JAVA_COMPLEXITY_CONFIG,
    cyclomatic_complexity,
    cognitive_complexity,
)

# La configuración de complejidad de Kotlin es idéntica a la de Java: ambos
# usan binary_expression + campo `operator` explícito para &&/||, y los
# tipos de nodo de decisión propios de Kotlin (if_expression, for_statement,
# while_statement, when_entry, catch_block) se mapean por separado abajo
# porque los NOMBRES de nodo difieren de Java aunque el criterio booleano
# sea el mismo. Ver hallazgos-kotlin.md §4.
from metrics.complexity import ComplexityLanguageConfig

_KOTLIN_CC_DECISION_TYPES = frozenset({
    "if_expression",
    "for_statement",
    "while_statement",
    "catch_block",
    # when_entry NO va aquí: su conteo depende de si tiene field `condition`
    # (rama con valor) o no (rama `else`) — se maneja vía
    # conditional_branch_types/is_active_branch más abajo, mismo patrón que
    # switch_label en Java.
})

_KOTLIN_COGNITIVE_NESTING_TYPES = frozenset({
    "if_expression",
    "for_statement",
    "while_statement",
    "catch_block",
    "when_expression",
})

_KOTLIN_COGNITIVE_INCREMENT_TYPES = frozenset()


def _kotlin_when_entry_has_condition(when_entry_node) -> bool:
    """
    Distingue una rama `when_entry` con valor (`0 -> ...`, cuenta como
    decisión) de la rama `else -> ...` (no cuenta). Verificado
    (hallazgos-kotlin.md §4): la rama con valor tiene un hijo con field
    name `condition`; la rama `else` no lo tiene (su primer hijo es el
    token literal `else`, sin field name).
    """
    return when_entry_node.child_by_field_name("condition") is not None


KOTLIN_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_KOTLIN_CC_DECISION_TYPES,
    cognitive_nesting_types=_KOTLIN_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_KOTLIN_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=JAVA_COMPLEXITY_CONFIG.is_boolean_node,
    get_boolean_parts=JAVA_COMPLEXITY_CONFIG.get_boolean_parts,
    conditional_branch_types=frozenset({"when_entry"}),
    is_active_branch=_kotlin_when_entry_has_condition,
)


def _extract_function(node, source: bytes) -> tuple[dict[str, Any], Any]:
    """
    Extrae un `function_declaration`. Verificado (hallazgos-kotlin.md §3):
    el cuerpo puede ser un `block` normal O una expresión directa sin
    llaves (`fun getX() = x`) — se pasa tal cual a cyclomatic_complexity/
    cognitive_complexity, que operan sobre cualquier nodo sin asumir su
    tipo específico.
    """
    name_node = node.child_by_field_name("name") or _first_named_child(node, "identifier")
    name = name_node.text.decode("utf-8") if name_node else "<anonima>"

    decorators, visibility = _extract_modifiers_and_annotations(node)
    is_async = _has_modifier_token(node, "suspend")

    params_node = _first_named_child(node, "function_value_parameters")
    params = _extract_parameters(params_node)

    body_node = _first_named_child(node, "function_body")
    # function_body envuelve tanto '= expr' como '{ block }'; se usa tal
    # cual como raíz para el cálculo de complejidad.
    complexity_root = body_node if body_node is not None else None

    cc = cyclomatic_complexity(complexity_root, KOTLIN_COMPLEXITY_CONFIG) if complexity_root else 1
    cog = cognitive_complexity(complexity_root, KOTLIN_COMPLEXITY_CONFIG) if complexity_root else 0
    # loc se mide sobre el function_declaration completo (firma + cuerpo),
    # no solo el body, para que funciones abstractas sin cuerpo (una sola
    # línea de firma) den loc=1 en vez de fallar por no tener body_node.
    loc = node.end_point[0] - node.start_point[0] + 1

    method_info = {
        "name": name,
        "isConstructor": False,
        "visibility": visibility,
        "isStatic": False,  # No se distingue static (companion object/object) del resto todavía
        "isAbstract": _has_modifier_token(node, "abstract"),
        "parameters": params,
        "returnType": "Any",  # se refina si se requiere el tipo de retorno explícito
        "cyclomaticComplexity": cc,
        "cognitiveComplexity": cog,
        "loc": loc,
        "isAsync": is_async,
        "decorators": decorators,
    }

    return method_info, complexity_root


# ─────────────────────────────────────────────────────────────────────────
# LCOM4 — usa extract_field_access_attributes (this.x explícito + acceso
# implícito filtrado contra known_field_names), no extract_self_attributes
# de Python. Ver hallazgos-kotlin.md §5 (adelanto) y metrics/cohesion.py.
# ─────────────────────────────────────────────────────────────────────────

from functools import partial

from metrics.cohesion import (
    calculate_class_metrics,
    extract_field_access_attributes,
)


def _compute_class_metrics(class_info: dict[str, Any]) -> dict[str, Any]:
    """
    Calcula LCOM4/WMC/CBO/etc. para una clase ya extraída, usando el
    extractor de atributos parametrizado para Kotlin (this.x explícito o
    acceso implícito, filtrado contra los nombres de atributos conocidos
    de la clase — incluye los del constructor primario).
    """
    known_field_names = {a["name"] for a in class_info["attributes"]}
    extractor = partial(
        extract_field_access_attributes,
        known_field_names=known_field_names,
        explicit_receiver="this",
    )
    # Kotlin no tiene un nombre de método constructor separado como "__init__"
    # de Python; el constructor primario se reportó con el mismo nombre que
    # la clase (ver _extract_class_declaration), así que ese nombre es el
    # que hay que excluir del grafo de cohesión.
    constructor_names = frozenset({class_info["name"]})

    metrics = calculate_class_metrics(
        methods=class_info["methods"],
        method_body_nodes=class_info["_methodBodyNodes"],
        attributes=class_info["attributes"],
        attribute_extractor=extractor,
        constructor_names=constructor_names,
    )
    return metrics


def _extract_top_level_functions(root, source: bytes) -> list[dict[str, Any]]:
    """
    Extrae `function_declaration` que son hijos DIRECTOS de source_file, no
    anidados dentro de ningún class_body/companion_object. Kotlin permite
    funciones top-level (fuera de cualquier clase) de forma idiomática, a
    diferencia de Java donde todo método vive dentro de una clase.
    """
    functions: list[dict[str, Any]] = []
    for child in root.children:
        if child.type == "function_declaration":
            m, _ = _extract_function(child, source)
            functions.append(m)
    return functions


# ─────────────────────────────────────────────────────────────────────────
# Detección de llamadas HTTP externas
# ─────────────────────────────────────────────────────────────────────────

def _detect_external_calls(root, source: bytes, module_id: str) -> list[dict[str, Any]]:
    """
    Detecta llamadas HTTP conocidas (OkHttp: newCall/execute; Ktor:
    HttpClient/get/post/put/delete).

    PENDIENTE DE VERIFICAR contra un volcado real de tree-sitter-kotlin: a
    diferencia del resto de este archivo (respaldado por
    hallazgos-kotlin.md), la forma exacta de una llamada a función
    (call_expression) no fue parte de esa investigación — se asume el
    mismo nombre de nodo `call_expression` que otras gramáticas de la
    familia JVM/C-like ya verificadas en este proyecto (java.py usa
    `method_invocation`, un nombre DISTINTO — no se puede asumir que
    Kotlin comparta ese nombre en particular). Se toma el texto del
    primer hijo (posicional, sin asumir field name) como aproximación del
    callee. Si un volcado real contradice el nombre de nodo o la
    estructura, ajustar aquí.
    """
    calls: list[dict[str, Any]] = []
    call_name_markers = (
        "newCall", "execute", ".get(", ".post(", ".put(", ".delete(",
        "HttpClient", "OkHttpClient",
    )

    def _visit(node):
        if node.type == "call_expression" and node.children:
            snippet = _node_text(node, source)[:80]
            if any(marker in snippet for marker in call_name_markers):
                calls.append({
                    "moduleId": module_id,
                    "externalSystemId": "http-api",
                    "protocol": "http",
                    "description": snippet[:60],
                })
        for child in node.children:
            _visit(child)

    _visit(root)
    return calls


def parse_kotlin_file(file_path: str, tree, source: bytes) -> dict[str, Any]:
    """
    Parseo detallado de un archivo Kotlin, extrayendo la estructura completa
    del código y computando métricas locales. Mismo formato de salida que
    parse_python_file (compatible con WorkerAnalysisResult.module).
    """
    import os
    import math

    root = tree.root_node
    module_id = file_path.replace("\\", "/").rsplit(".", 1)[0]
    module_name = os.path.basename(file_path).rsplit(".", 1)[0]

    imports_data = _extract_imports(root, source)
    classes = _extract_classes(root, source, module_id)
    functions = _extract_top_level_functions(root, source)
    external_calls = _detect_external_calls(root, source, module_id)

    # Calcular métricas por clase y limpiar el campo interno _methodBodyNodes
    # antes de exponer el resultado (no es parte del esquema WorkerAnalysisResult).
    for class_info in classes:
        class_info["metrics"] = _compute_class_metrics(class_info)
        del class_info["_methodBodyNodes"]

    import_ids = [imp["source"] for imp in imports_data if imp["source"] != "<desconocido>"]

    loc = len(source.splitlines())
    lloc = sum(1 for line in source.splitlines() if line.strip())

    all_cc = (
        [f["cyclomaticComplexity"] for f in functions]
        + [m["cyclomaticComplexity"] for c in classes for m in c.get("methods", [])]
    )
    cc_avg = sum(all_cc) / len(all_cc) if all_cc else 1.0
    cc_max = max(all_cc) if all_cc else 1

    total_classes = len(classes)
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
            "language": "kotlin",
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
                "abstractness": 0.0,
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