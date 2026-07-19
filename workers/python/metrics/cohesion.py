"""
metrics/cohesion.py — Cálculo de LCOM4 (Lack of Cohesion of Methods) para
clases Python, usando NetworkX para encontrar componentes conexos.

Algoritmo LCOM4 (§4.3.2 de la especificación):
  1. Construir un grafo no dirigido donde los nodos son los métodos de la clase.
  2. Dos métodos están conectados (arista) si ambos acceden a al menos un
     atributo de instancia (`self.x`) en común.
  3. LCOM4 = número de componentes conexos del grafo.

Interpretación:
  - LCOM4 = 1 → clase perfectamente cohesiva.
  - LCOM4 > 1 → la clase contiene N responsabilidades independientes y es
    candidata a ser dividida en LCOM4 clases separadas.
  - LCOM4 = 0 → clase sin métodos (no aplica; se devuelve 0).

Referencia: §4.3.2 de la especificación técnica SAAC.
"""

from __future__ import annotations

from typing import Any, Callable

import networkx as nx

# Tipos primitivos de Python excluidos del cálculo de CBO (Coupling Between
# Objects): acoplarse a un `str` o `int` no cuenta como dependencia real
# entre clases del sistema. Se expone a nivel de módulo para que:
#   1. `calculate_class_metrics` la use como valor por defecto.
#   2. Los parsers de otros lenguajes (java.py, kotlin.py, csharp.py) puedan
#      pasar su propio set de primitivos vía `primitive_types=`.
PYTHON_PRIMITIVES: frozenset[str] = frozenset(
    {"str", "int", "float", "bool", "None", "bytes", "any", "Any"}
)


def extract_self_attributes(method_body_node) -> set[str]:
    """
    Extrae todos los nombres de atributos de instancia (`self.x`) accedidos
    dentro del cuerpo de un método, tanto en lectura como en escritura.

    Recorre el AST buscando nodos `attribute` donde:
      - El objeto (primer hijo) es un `identifier` con texto `self`.
      - El atributo (campo `attribute`) es un `identifier`.

    Args:
        method_body_node: Nodo tree-sitter del cuerpo (block) del método.

    Returns:
        Conjunto de nombres de atributos accedidos (ej: {"name", "age"}).
    """
    attrs: set[str] = set()

    def _visit(node):
        if node.type == "attribute":
            children = node.children
            # Estructura: object '.' attribute_name
            # El objeto debe ser `self` (identifier con texto "self")
            if (
                len(children) >= 3
                and children[0].type == "identifier"
                and children[0].text == b"self"
                and children[2].type == "identifier"
            ):
                attrs.add(children[2].text.decode("utf-8"))

        for child in node.children:
            _visit(child)

    _visit(method_body_node)
    return attrs


def extract_field_access_attributes(
    method_body_node,
    known_field_names: set[str],
    explicit_receiver: str = "this",
) -> set[str]:
    """
    Extrae atributos de instancia accedidos en lenguajes tipo Java/C#/Kotlin,
    donde el acceso puede ser EXPLÍCITO (`this.x`) o IMPLÍCITO (`x` a secas).

    Diferencia clave respecto a `extract_self_attributes` (Python): en
    Python, `self.x` es la ÚNICA forma de acceder a un atributo de
    instancia, así que basta con el patrón sintáctico `self.<nombre>`. En
    Java (verificado contra el AST real), el acceso implícito sin `this.`
    es extremadamente común y produce un `identifier` suelto,
    SINTÁCTICAMENTE INDISTINGUIBLE de una variable local. La única forma de
    saber si ese identifier es un campo de la clase es comparándolo contra
    la lista de nombres de campos ya conocidos (`known_field_names`),
    extraída previamente de los `field_declaration` de la clase.

    Args:
        method_body_node: Nodo tree-sitter del cuerpo del método.
        known_field_names: Nombres de los atributos/campos declarados en la
            clase (obtenidos de la extracción de `field_declaration`).
        explicit_receiver: Nombre del receptor explícito ("this" para
            Java/C#, "self" para Kotlin, ajustable por lenguaje).

    Returns:
        Conjunto de nombres de atributos accedidos, explícita o
        implícitamente, filtrados contra `known_field_names` para no
        confundir variables locales que casualmente comparten AST shape.
    """
    attrs: set[str] = set()
    explicit_bytes = explicit_receiver.encode()

    def _visit(node):
        if node.type == "field_access":
            children = node.children
            if (
                len(children) >= 3
                and children[0].type == explicit_receiver
                and children[0].text == explicit_bytes
                and children[2].type == "identifier"
            ):
                attrs.add(children[2].text.decode("utf-8"))
        elif node.type == "identifier":
            # Acceso implícito: solo cuenta si el nombre coincide con un
            # campo conocido de la clase. Sin este filtro, CUALQUIER
            # variable local o parámetro se contaría como atributo,
            # colapsando LCOM4 artificialmente (falso positivo de cohesión).
            name = node.text.decode("utf-8")
            if name in known_field_names:
                attrs.add(name)

        for child in node.children:
            _visit(child)

    _visit(method_body_node)
    return attrs


def calculate_lcom4(
    methods: list[dict[str, Any]],
    method_body_nodes: list[Any],
    attribute_extractor: Callable[[Any], set[str]] = extract_self_attributes,
    constructor_names: frozenset[str] = frozenset({"__init__", "constructor"}),
) -> int:
    """
    Calcula LCOM4 para una clase dados sus métodos y los nodos AST de sus
    cuerpos.

    Args:
        methods: Lista de dicts con al menos {"name": str} por cada método.
        method_body_nodes: Lista paralela de nodos tree-sitter (block) de
            cada método, en el mismo orden que `methods`.
        attribute_extractor: Función que, dado el nodo de cuerpo de un
            método, devuelve el conjunto de atributos de instancia que
            accede. Por defecto usa `extract_self_attributes` (Python).
            Para lenguajes tipo Java, pasar una función parcial de
            `extract_field_access_attributes` con `known_field_names` ya
            aplicado (ver `parsers/java.py`).
        constructor_names: Nombres de método a excluir del grafo de
            cohesión por ser constructores (ver nota sobre "efecto puente"
            más abajo). Java usa el nombre de la propia clase como nombre
            de constructor, así que este set se pasa explícitamente por
            lenguaje en vez de asumir un valor fijo.

    Returns:
        LCOM4 (entero >= 0). 0 si la clase no tiene métodos evaluables.
    """
    n = len(methods)
    if n == 0:
        return 0

    # Paso 1: extraer los atributos usados por cada método, excluyendo
    # constructores. Excluir el constructor evita el "efecto puente": si
    # el constructor inicializa TODOS los atributos, cualquier par de
    # métodos quedaría conectado transitivamente a través de él, aunque no
    # compartan responsabilidad real — colapsando LCOM4 a 1 artificialmente.
    method_attrs: list[tuple[str, set[str]]] = []
    for method, body_node in zip(methods, method_body_nodes):
        name = method["name"]
        if name in constructor_names:
            continue
        attrs = attribute_extractor(body_node) if body_node is not None else set()
        method_attrs.append((name, attrs))

    # Paso 2: construir el grafo de cohesión.
    graph = nx.Graph()
    for name, _ in method_attrs:
        graph.add_node(name)

    num_methods = len(method_attrs)
    for i in range(num_methods):
        for j in range(i + 1, num_methods):
            name_i, attrs_i = method_attrs[i]
            name_j, attrs_j = method_attrs[j]
            # Si comparten al menos un atributo, están cohesionados.
            if attrs_i & attrs_j:
                graph.add_edge(name_i, name_j)

    # Paso 3: LCOM4 = número de componentes conexos.
    return nx.number_connected_components(graph)


def calculate_class_metrics(
    methods: list[dict[str, Any]],
    method_body_nodes: list[Any],
    attributes: list[dict[str, Any]],
    attribute_extractor: Callable[[Any], set[str]] = extract_self_attributes,
    constructor_names: frozenset[str] = frozenset({"__init__", "constructor"}),
    primitive_types: frozenset[str] | set[str] = PYTHON_PRIMITIVES,
) -> dict[str, Any]:
    """
    Calcula las métricas OOP completas de una clase (§4.3.1, §4.3.2, §4.3.3).

    Args:
        methods: Lista de dicts de MethodInfo.
        method_body_nodes: Nodos AST del cuerpo de cada método (paralelo).
        attributes: Lista de dicts de AttributeInfo.
        attribute_extractor: Ver `calculate_lcom4`; por defecto Python.
        constructor_names: Ver `calculate_lcom4`; por defecto Python.
        primitive_types: Tipos a excluir del cálculo de CBO por no
            representar acoplamiento real entre clases. Por defecto
            `PYTHON_PRIMITIVES`; los parsers de otros lenguajes deben pasar
            su propio set (ej. Java: {"int", "long", "boolean", "String",
            "void", ...}).

    Returns:
        Dict con WMC, DIT, NOC, CBO, RFC, MPC, LCOM4, TCC, LCC.
    """
    # WMC: Weighted Methods per Class = Σ CC de todos los métodos
    wmc = sum(m.get("cyclomaticComplexity", 1) for m in methods)

    # LCOM4
    lcom4 = calculate_lcom4(methods, method_body_nodes, attribute_extractor, constructor_names)

    # CBO: tipos referenciados en parámetros y atributos (primitivos excluidos)
    referenced_types: set[str] = set()
    for attr in attributes:
        t = attr.get("type", "any")
        if t not in primitive_types:
            referenced_types.add(t)
    for method in methods:
        for param in method.get("parameters", []):
            t = param.get("type", "any")
            if t not in primitive_types:
                referenced_types.add(t)
    cbo = len(referenced_types)

    # RFC: número de métodos propios (las llamadas externas se cuentan en Rust)
    rfc = len(methods)

    # TCC / LCC: heurístico (se refinará con análisis detallado del body)
    n = len(methods)
    if n < 2 or len(attributes) == 0:
        tcc = 1.0 if n <= 1 else 0.0
        lcc = tcc
    else:
        # Calcular pares de métodos que comparten atributos (TCC)
        method_attr_list = []
        for body_node in method_body_nodes:
            method_attr_list.append(
                attribute_extractor(body_node) if body_node is not None else set()
            )

        total_pairs = (n * (n - 1)) // 2
        connected_pairs = 0
        for i in range(n):
            for j in range(i + 1, n):
                if method_attr_list[i] & method_attr_list[j]:
                    connected_pairs += 1
        tcc = connected_pairs / total_pairs if total_pairs > 0 else 0.0
        lcc = tcc  # LCC >= TCC; sin análisis transitivo, usamos TCC como bound

    return {
        "wmc": wmc,
        "dit": 0,       # Se calcula en Rust con el árbol de herencia completo
        "noc": 0,       # Se calcula en Rust con todas las clases del proyecto
        "cbo": cbo,
        "rfc": rfc,
        "mpc": 0,       # Se completa en Rust (llamadas externas)
        "lcom4": lcom4,
        "tcc": round(tcc, 4),
        "lcc": round(lcc, 4),
    }