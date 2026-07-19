"""
metrics/complexity.py — Cálculo de Complejidad Ciclomática y Cognitiva,
generalizado para múltiples lenguajes.

Complejidad Ciclomática (CC):
  CC = 1 + Σ(puntos de decisión)

Complejidad Cognitiva (SonarSource style):
  Incrementa por: estructuras de control + penalización por nivel de
  anidamiento. Los operadores lógicos suman +1 por cada "corrida" (run) de
  operadores consecutivos del mismo tipo dentro de una misma expresión —no
  uno por cada nodo booleano individual. Ver `_boolean_run_increments`.

Generalización multi-lenguaje (a partir de Java, segundo lenguaje tras
Python): cada lenguaje define sus propios tipos de nodo de decisión y su
propio criterio para identificar un operador booleano corto-circuito, ya
que esto varía de forma real entre gramáticas — no es un detalle cosmético.
Verificado: Python modela `and`/`or` con un tipo de nodo dedicado
(`boolean_operator`), mientras que Java los modela como `binary_expression`
genérico (el mismo nodo que usa para `>`, `+`, etc.), distinguible solo por
el valor de su campo `operator`. Forzar un único criterio fijo para todos
los lenguajes hubiera sido incorrecto para Java desde el primer caso de
prueba.

Referencia: §4.3 de la especificación técnica SAAC.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


@dataclass(frozen=True)
class ComplexityLanguageConfig:
    """
    Configuración específica de lenguaje para el cálculo de complejidad.
    Cada campo se valida contra el AST real del lenguaje antes de escribirse
    (ver hallazgos-<lenguaje>.md) — no se completa por analogía sin probar.
    """

    # Tipos de nodo que son puntos de decisión para CC (if, for, while,
    # except/catch, ternario, case, etc. — lo que aplique al lenguaje).
    cc_decision_types: frozenset[str]

    # Tipos de nodo que incrementan tanto el anidamiento como la base de
    # complejidad cognitiva (estructuras de control "primarias").
    cognitive_nesting_types: frozenset[str]

    # Tipos de nodo que suman +1 a la cognitiva SIN incrementar el
    # anidamiento (elif/else/case adicionales dentro de la misma estructura).
    cognitive_increment_types: frozenset[str]

    # Predicado: dado un nodo, ¿es una expresión booleana corto-circuito
    # (and/or/&&/||)? Se separa del "tipo de nodo" porque algunos lenguajes
    # (Java) no tienen un tipo de nodo dedicado — hay que inspeccionar un
    # campo. Python: `node.type == "boolean_operator"`. Java:
    # `node.type == "binary_expression" and operator field in {"&&", "||"}`.
    is_boolean_node: Callable[[object], bool]

    # Dado un nodo booleano (para el cual is_boolean_node ya dio True),
    # devuelve sus campos `left`/`operator` como (left_node_or_None,
    # operator_text_or_None). Se abstrae porque el nombre del campo o la
    # forma de acceder al operador puede variar por lenguaje.
    get_boolean_parts: Callable[[object], tuple[object | None, str | None]]

    # Predicado opcional para nodos "de rama condicional" cuyo conteo como
    # punto de decisión depende de una inspección adicional, no solo del
    # tipo de nodo — por ejemplo, distinguir `case X` (cuenta) de `default`
    # (no cuenta) dentro de un switch_label de Java, o una rama `when_entry`
    # con condición (cuenta) de la rama `else` (no cuenta) en Kotlin. Se
    # aplica a cualquier nodo cuyo tipo esté en `conditional_branch_types`;
    # si ese set está vacío (default), todos los nodos en
    # cc_decision_types/cognitive_*_types cuentan siempre, sin excepción
    # condicional — comportamiento de Python, que no tiene este caso.
    conditional_branch_types: frozenset[str] = field(default_factory=frozenset)
    is_active_branch: Callable[[object], bool] = lambda node: True


# ── Configuración para Python (comportamiento original, sin cambios) ──

_PYTHON_CC_DECISION_TYPES = frozenset({
    "if_statement",
    "elif_clause",
    "for_statement",
    "while_statement",
    "except_clause",
    "conditional_expression",   # x if cond else y
    "case_clause",              # match/case (Python 3.10+)
})

_PYTHON_COGNITIVE_NESTING_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "while_statement",
    "except_clause",
    "with_statement",
    "match_statement",
})

_PYTHON_COGNITIVE_INCREMENT_TYPES = frozenset({
    "elif_clause",
    "else_clause",
    "conditional_expression",
    "case_clause",
})


def _python_is_boolean_node(node) -> bool:
    return node.type == "boolean_operator"


def _python_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    op = node.child_by_field_name("operator")
    return left, (op.text.decode() if op is not None else None)


PYTHON_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_PYTHON_CC_DECISION_TYPES,
    cognitive_nesting_types=_PYTHON_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_PYTHON_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_python_is_boolean_node,
    get_boolean_parts=_python_get_boolean_parts,
)


# ── Configuración para Java ──
#
# Verificado contra tree-sitter-java (ver hallazgos-java.md):
#   - if_statement, for_statement, enhanced_for_statement (for-each, tipo
#     de nodo DISTINTO al for clásico), while_statement, catch_clause,
#     ternary_expression, switch_label (case, no default) son decisión.
#   - && / || son binary_expression genérico, NO un tipo de nodo propio;
#     se distinguen por el valor del campo `operator`.
#   - Java no tiene elif; el equivalente son if_statement anidados dentro
#     del campo `alternative` de un if_statement padre (no un tipo de nodo
#     "else if" separado) — verificado que Java no usa un nodo `elif`.

_JAVA_CC_DECISION_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "catch_clause",
    "ternary_expression",
    # switch_label NO va aquí: su conteo depende de "case" vs "default",
    # se maneja vía conditional_branch_types/is_active_branch más abajo.
})

_JAVA_COGNITIVE_NESTING_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "catch_clause",
    "switch_expression",
})

_JAVA_COGNITIVE_INCREMENT_TYPES = frozenset({
    "ternary_expression",
})

_JAVA_BOOLEAN_OPERATORS = frozenset({"&&", "||"})


def _java_is_boolean_node(node) -> bool:
    if node.type != "binary_expression":
        return False
    op = node.child_by_field_name("operator")
    return op is not None and op.text.decode() in _JAVA_BOOLEAN_OPERATORS


def _java_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    op = node.child_by_field_name("operator")
    return left, (op.text.decode() if op is not None else None)


def _java_is_case_not_default(switch_label_node) -> bool:
    """
    Distingue `case X:` de `default:` dentro de un switch_label. Verificado
    contra el AST real de Java: el primer hijo del switch_label es el token
    literal `case` o `default`.
    """
    if switch_label_node.child_count == 0:
        return False
    return switch_label_node.child(0).type == "case"


JAVA_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_JAVA_CC_DECISION_TYPES,
    cognitive_nesting_types=_JAVA_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_JAVA_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_java_is_boolean_node,
    get_boolean_parts=_java_get_boolean_parts,
    conditional_branch_types=frozenset({"switch_label"}),
    is_active_branch=_java_is_case_not_default,
)


# ── Configuración para C# ──
#
# Verificado contra tree-sitter-c-sharp (ver research de Fase 1, hallazgos
# de control flow): el patrón binary_expression + campo `operator` explícito
# es IDÉNTICO a Java para &&/||, así que is_boolean_node/get_boolean_parts
# se reutilizan sin adaptación (misma forma de AST, no analogía sin probar).
#
#   - if_statement, for_statement, while_statement, foreach_statement
#     (equivalente a enhanced_for_statement de Java, tipo de nodo propio,
#     verificado con volcado de AST), catch_clause, conditional_expression
#     (ternario ?:) son decisión.
#   - switch_section es el equivalente de switch_label de Java: el primer
#     hijo es el token `case` o `default`, mismo criterio de distinción por
#     posición — verificado en el research ("mismo criterio de distinción
#     por posición").
#   - C# tampoco tiene un nodo "else if" separado: son if_statement
#     anidados en el campo `alternative`, igual que Java.

_CSHARP_CC_DECISION_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "while_statement",
    "foreach_statement",
    "catch_clause",
    "conditional_expression",
    # switch_section NO va aquí: su conteo depende de "case" vs "default",
    # se maneja vía conditional_branch_types/is_active_branch más abajo.
})

_CSHARP_COGNITIVE_NESTING_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "while_statement",
    "foreach_statement",
    "catch_clause",
    "switch_expression",  # switch como expresión (C# 8+); switch_statement
                           # clásico se cubre vía switch_section arriba.
})

_CSHARP_COGNITIVE_INCREMENT_TYPES = frozenset({
    "conditional_expression",
})

_CSHARP_BOOLEAN_OPERATORS = frozenset({"&&", "||"})


def _csharp_is_boolean_node(node) -> bool:
    if node.type != "binary_expression":
        return False
    op = node.child_by_field_name("operator")
    return op is not None and op.text.decode() in _CSHARP_BOOLEAN_OPERATORS


def _csharp_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    op = node.child_by_field_name("operator")
    return left, (op.text.decode() if op is not None else None)


def _csharp_is_case_not_default(switch_section_node) -> bool:
    """
    Distingue `case X:` de `default:` dentro de un switch_section. Verificado
    contra el research de C#: switch_section usa case/default como primer
    hijo, mismo criterio posicional que switch_label de Java. Nota: un
    switch_section puede agrupar varias etiquetas (case A: case B: ...);
    aquí se cuenta la sección si CUALQUIERA de sus labels iniciales es
    `case` (no solo el primer hijo), ya que C# permite fall-through de
    labels antes del primer statement — un solo `default:` inicial sin
    ningún `case` es la única forma que no debe contar.
    """
    for child in switch_section_node.children:
        if child.type == "case":
            return True
        if child.type == "default":
            continue
        # Primer nodo que no es una etiqueta case/default: dejamos de
        # inspeccionar labels (ya llegamos al cuerpo de la sección).
        if child.type not in ("case", "default", ":"):
            break
    return False


CSHARP_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_CSHARP_CC_DECISION_TYPES,
    cognitive_nesting_types=_CSHARP_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_CSHARP_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_csharp_is_boolean_node,
    get_boolean_parts=_csharp_get_boolean_parts,
    conditional_branch_types=frozenset({"switch_section"}),
    is_active_branch=_csharp_is_case_not_default,
)


# ── Configuración para Swift ──
#
# Verificado contra tree-sitter-swift (dump_swift.py, dump_swift_class.py):
#   - if_statement, guard_statement, for_statement, while_statement,
#     repeat_while_statement, catch_block son decisión.
#   - Catch es `catch_block` (dentro de `do_statement`), NO `catch_clause`.
#   - switch_statement no se cuenta directamente: sus switch_entry (case)
#     se manejan vía conditional_branch_types, distinguiendo `case` de
#     `default_keyword` por tipo de nodo del primer hijo.
#   - && / || : tree-sitter-swift los modela con tipos de nodo PROPIOS
#     (`conjunction_expression` / `disjunction_expression`), confirmado
#     en dumps. No son binary_expression genérico.

_SWIFT_CC_DECISION_TYPES = frozenset({
    "if_statement",
    "guard_statement",
    "for_statement",
    "while_statement",
    "repeat_while_statement",
    "catch_block",
})

_SWIFT_COGNITIVE_NESTING_TYPES = frozenset({
    "if_statement",
    "guard_statement",
    "for_statement",
    "while_statement",
    "repeat_while_statement",
    "catch_block",
    "switch_statement",
})

_SWIFT_COGNITIVE_INCREMENT_TYPES: frozenset[str] = frozenset()


def _swift_is_boolean_node(node) -> bool:
    return node.type in ("conjunction_expression", "disjunction_expression")


def _swift_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    if left is None and node.children:
        left = node.children[0]
    op = "&&" if node.type == "conjunction_expression" else "||"
    return left, op


def _swift_is_case_not_default(switch_entry_node) -> bool:
    """
    Distingue `case X:` de `default:` dentro de un switch_entry de Swift.
    Verificado: `case` tiene un hijo `case` keyword, `default` tiene
    un hijo `default_keyword`.
    """
    for child in switch_entry_node.children:
        if child.type == "case":
            return True
        if child.type == "default_keyword":
            return False
    return False


SWIFT_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_SWIFT_CC_DECISION_TYPES,
    cognitive_nesting_types=_SWIFT_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_SWIFT_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_swift_is_boolean_node,
    get_boolean_parts=_swift_get_boolean_parts,
    conditional_branch_types=frozenset({"switch_entry"}),
    is_active_branch=_swift_is_case_not_default,
)


# ── Configuración para Go ──
#
# Basada en la gramática estándar de tree-sitter-go. PENDIENTE DE VERIFICAR
# contra un volcado real con workers/python/scratch/dump_go.py antes de
# confiar en ella para producción — mismo criterio que Swift arriba.
#
#   - if_statement y for_statement (Go usa el MISMO tipo de nodo para for
#     clásico, range-for y for infinito, distinguidos por sus hijos, no
#     por tipo — no afecta el conteo de CC) son decisión/iteración.
#   - type_switch_statement y expression_switch_statement son los dos
#     tipos de switch de Go; sus cláusulas (`expression_case`/`type_case`
#     vs `default_case`) se manejan vía conditional_branch_types,
#     distinguibles por TIPO de nodo (no por posición, a diferencia de
#     Java/C#/Swift).
#   - && / || : Go modela estos como binary_expression genérico con campo
#     `operator` explícito, mismo patrón que Java/C#.
#   - Go no tiene operador ternario.

_GO_CC_DECISION_TYPES = frozenset({
    "if_statement",
    "for_statement",
})

_GO_COGNITIVE_NESTING_TYPES = frozenset({
    "if_statement",
    "for_statement",
    "type_switch_statement",
    "expression_switch_statement",
})

_GO_COGNITIVE_INCREMENT_TYPES: frozenset[str] = frozenset()

_GO_BOOLEAN_OPERATORS = frozenset({"&&", "||"})


def _go_is_boolean_node(node) -> bool:
    if node.type != "binary_expression":
        return False
    op = node.child_by_field_name("operator")
    return op is not None and op.text.decode() in _GO_BOOLEAN_OPERATORS


def _go_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    op = node.child_by_field_name("operator")
    return left, (op.text.decode() if op is not None else None)


def _go_is_case_not_default(case_node) -> bool:
    """
    Distingue una cláusula `case`/`default` en un switch de Go.
    PENDIENTE DE VERIFICAR: se asume que expression_case/type_case
    (contienen una lista de expresiones/tipos) representan `case`, y
    default_case (sin lista) representa `default` — distinguibles por
    tipo de nodo.
    """
    return case_node.type in ("expression_case", "type_case")


GO_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_GO_CC_DECISION_TYPES,
    cognitive_nesting_types=_GO_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_GO_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_go_is_boolean_node,
    get_boolean_parts=_go_get_boolean_parts,
    conditional_branch_types=frozenset({"expression_case", "type_case", "default_case"}),
    is_active_branch=_go_is_case_not_default,
)


# ── Configuración para Rust ──
#
# Basada en la gramática estándar de tree-sitter-rust. PENDIENTE DE
# VERIFICAR contra un volcado real de control flow (dump_rust_imports.py
# solo cubrió imports) antes de confiar en ella para producción.
#
#   - if_expression, while_expression, loop_expression (loop infinito) y
#     for_expression son decisión/iteración.
#   - match_expression no se cuenta directamente: sus match_arm se manejan
#     vía conditional_branch_types, excluyendo el patrón comodín `_`
#     (wildcard_pattern) del conteo — mismo espíritu que excluir `default`
#     en switch de Java/C#/Go.
#   - && / || : Rust modela estos como binary_expression genérico con
#     campo `operator` explícito, mismo patrón que Java/C#/Go.

_RUST_CC_DECISION_TYPES = frozenset({
    "if_expression",
    "while_expression",
    "loop_expression",
    "for_expression",
})

_RUST_COGNITIVE_NESTING_TYPES = frozenset({
    "if_expression",
    "while_expression",
    "loop_expression",
    "for_expression",
    "match_expression",
})

_RUST_COGNITIVE_INCREMENT_TYPES: frozenset[str] = frozenset()

_RUST_BOOLEAN_OPERATORS = frozenset({"&&", "||"})


def _rust_is_boolean_node(node) -> bool:
    if node.type != "binary_expression":
        return False
    op = node.child_by_field_name("operator")
    return op is not None and op.text.decode() in _RUST_BOOLEAN_OPERATORS


def _rust_get_boolean_parts(node):
    left = node.child_by_field_name("left")
    op = node.child_by_field_name("operator")
    return left, (op.text.decode() if op is not None else None)


def _rust_is_active_match_arm(match_arm_node) -> bool:
    """
    Excluye el brazo comodín `_ => ...` del conteo de decisión, igual
    criterio que excluir `default` en Java/C#/Go. PENDIENTE DE VERIFICAR:
    se asume que match_arm expone su patrón vía el campo `pattern`, y que
    el comodín se representa como un nodo `_` (o `wildcard_pattern`).
    """
    pattern = match_arm_node.child_by_field_name("pattern")
    if pattern is None:
        return True
    return pattern.type not in ("_", "wildcard_pattern")


RUST_COMPLEXITY_CONFIG = ComplexityLanguageConfig(
    cc_decision_types=_RUST_CC_DECISION_TYPES,
    cognitive_nesting_types=_RUST_COGNITIVE_NESTING_TYPES,
    cognitive_increment_types=_RUST_COGNITIVE_INCREMENT_TYPES,
    is_boolean_node=_rust_is_boolean_node,
    get_boolean_parts=_rust_get_boolean_parts,
    conditional_branch_types=frozenset({"match_arm"}),
    is_active_branch=_rust_is_active_match_arm,
)


def cyclomatic_complexity(body_node, config: ComplexityLanguageConfig = PYTHON_COMPLEXITY_CONFIG) -> int:
    """
    Calcula la complejidad ciclomática del cuerpo de una función/método.
    `config` por defecto es Python, para no romper las llamadas existentes
    en parsers/python.py que no pasan este argumento.

    Args:
        body_node: Nodo tree-sitter del cuerpo de la función.
        config: Configuración de tipos de nodo específica del lenguaje.

    Returns:
        CC >= 1 (1 = camino base, sin decisiones).
    """
    cc = 1

    def _visit(node):
        nonlocal cc
        if node.type in config.conditional_branch_types:
            # Nodo cuyo conteo depende de un predicado adicional (ej: "case"
            # vs "default" en switch_label de Java, o rama con condición vs
            # "else" en when_entry de Kotlin) — no se cuenta solo por tipo.
            if config.is_active_branch(node):
                cc += 1
        elif node.type in config.cc_decision_types:
            cc += 1
        elif config.is_boolean_node(node):
            cc += 1
        for child in node.children:
            _visit(child)

    _visit(body_node)
    return cc


def _flatten_boolean_operators(node, config: ComplexityLanguageConfig) -> list[str]:
    """
    Aplana una expresión booleana potencialmente anidada en la secuencia
    ordenada de operadores que contiene, de izquierda a derecha.

    Válido para cualquier lenguaje cuya gramática anide operadores
    asociativos a la izquierda (verificado para Python y Java: ambos
    ponen el operador más a la derecha del código fuente en la raíz del
    árbol, con los operadores anteriores anidados en el campo `left`).
    Si un futuro lenguaje asocia a la derecha, este helper necesitará una
    variante — no asumir que todos los lenguajes comparten esta forma sin
    verificarlo primero, tal como se hizo aquí para Java.
    """
    operators: list[str] = []

    def _visit(n):
        if not config.is_boolean_node(n):
            return
        left, op = config.get_boolean_parts(n)
        if left is not None and config.is_boolean_node(left):
            _visit(left)
        if op is not None:
            operators.append(op)

    _visit(node)
    return operators


def _boolean_run_increments(operators: list[str]) -> int:
    """
    Aplica la regla de SonarSource para secuencias de operadores lógicos:
    una corrida (run) de operadores consecutivos del MISMO tipo cuenta como
    un solo incremento (+1). Agnóstica del lenguaje: opera sobre una lista
    de strings de operador, sin importar su origen.
    """
    if not operators:
        return 0

    increments = 1
    for prev, curr in zip(operators, operators[1:]):
        if curr != prev:
            increments += 1
    return increments


def cognitive_complexity(body_node, config: ComplexityLanguageConfig = PYTHON_COMPLEXITY_CONFIG) -> int:
    """
    Calcula la complejidad cognitiva del cuerpo de una función/método
    siguiendo el modelo de SonarSource, generalizado por lenguaje.

    `config` por defecto es Python, para no romper las llamadas existentes.

    Args:
        body_node: Nodo tree-sitter del cuerpo de la función.
        config: Configuración de tipos de nodo específica del lenguaje.

    Returns:
        Complejidad cognitiva >= 0.
    """
    total = 0

    def _visit(node, nesting_level: int):
        nonlocal total
        increments_nesting = False

        if node.type in config.conditional_branch_types:
            if config.is_active_branch(node):
                total += 1
        elif node.type in config.cognitive_nesting_types:
            total += 1 + nesting_level
            increments_nesting = True

        elif node.type in config.cognitive_increment_types:
            total += 1

        elif config.is_boolean_node(node):
            # Solo se procesa si este nodo es la RAÍZ de su expresión
            # booleana. Se compara por `==`, no por `is`: verificado que
            # tree-sitter no garantiza identidad de objeto Python estable
            # entre llamadas a child_by_field_name/child().
            parent = node.parent
            is_left_child_of_boolean = (
                parent is not None
                and config.is_boolean_node(parent)
                and config.get_boolean_parts(parent)[0] == node
            )
            if not is_left_child_of_boolean:
                operators = _flatten_boolean_operators(node, config)
                total += _boolean_run_increments(operators)

        for child in node.children:
            child_nesting = nesting_level + 1 if increments_nesting else nesting_level
            _visit(child, child_nesting)

    _visit(body_node, 0)
    return total