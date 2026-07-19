"""
parsers/__init__.py — Punto de entrada de parseo por lenguaje.

Despacha al parser especializado cuando existe, aplica clasificación
funcional (detect_module_type) como post-proceso, y cae al parser
genérico (conteo de nodos/líneas) para lenguajes sin parser dedicado.
"""

from __future__ import annotations

from typing import Any

from tree_sitter_language_pack import get_parser

from language_registry import LanguageSpec
from patterns import detect_module_type

# Cache de parsers por nombre de tree-sitter, para no pagar el costo de
# get_parser() (que implica resolución + posible carga desde caché en disco)
# en cada archivo individual dentro de un batch grande.
_parser_cache: dict[str, Any] = {}


def _get_cached_parser(ts_name: str):
    parser = _parser_cache.get(ts_name)
    if parser is None:
        parser = get_parser(ts_name)
        _parser_cache[ts_name] = parser
    return parser


def _count_logical_lines(source: bytes) -> int:
    """
    Cuenta líneas no vacías como aproximación inicial de LLOC. Se refinará
    por lenguaje (excluyendo comentarios de bloque/línea específicos de cada
    gramática) en la iteración de métricas detalladas.
    """
    return sum(1 for line in source.splitlines() if line.strip())


def _apply_module_type(result: dict[str, Any], file_path: str) -> dict[str, Any]:
    """
    Post-proceso: aplica detect_module_type() sobre el resultado ya
    parseado para clasificar el rol funcional del módulo (service,
    controller, model, repository, etc.).

    Se ejecuta una sola vez aquí en vez de duplicar la lógica en cada
    parser individual — todos los parsers devuelven la misma estructura
    con module.classes, module.functions y module.imports.
    """
    module = result.get("module")
    if module is None:
        # Fallback genérico (no tiene la estructura "module")
        classes = result.get("classes", [])
        functions = result.get("functions", [])
        imports = result.get("imports", [])
        result["moduleType"] = detect_module_type(file_path, classes, functions, imports)
        return result

    classes = module.get("classes", [])
    functions = module.get("functions", [])
    imports = module.get("imports", [])

    module["moduleType"] = detect_module_type(file_path, classes, functions, imports)
    return result


def parse_file(file_path: str, spec: LanguageSpec) -> dict[str, Any]:
    """
    Parsea un único archivo con tree-sitter y devuelve una representación
    del módulo. Lanza FileNotFoundError si el archivo no existe.

    Si el lenguaje tiene un parser especializado, se deriva a él.
    De lo contrario, se usa el parser genérico. En ambos casos, se aplica
    detect_module_type() como post-proceso para clasificar el rol funcional.
    """
    with open(file_path, "rb") as f:
        source = f.read()

    parser = _get_cached_parser(spec.ts_name)
    tree = parser.parse(source)
    root = tree.root_node

    result: dict[str, Any]

    # Derivar al parser detallado
    if spec.saac_id == "python":
        from parsers.python import parse_python_file
        result = parse_python_file(file_path, tree, source)
    elif spec.saac_id == "java":
        from parsers.java import parse_java_file
        result = parse_java_file(file_path, tree, source)
    elif spec.saac_id == "kotlin":
        from parsers.kotlin import parse_kotlin_file
        result = parse_kotlin_file(file_path, tree, source)
    elif spec.saac_id == "csharp":
        from parsers.csharp import parse_csharp_file
        result = parse_csharp_file(file_path, tree, source)
    elif spec.saac_id == "swift":
        from parsers.swift import parse_swift_file
        result = parse_swift_file(file_path, tree, source)
    elif spec.saac_id == "go":
        from parsers.go import parse_go_file
        result = parse_go_file(file_path, tree, source)
    elif spec.saac_id == "rust":
        from parsers.rust import parse_rust_file
        result = parse_rust_file(file_path, tree, source)
    else:
        # Parser genérico (fallback para lenguajes sin parser especializado)
        result = {
            "filePath": file_path,
            "language": spec.saac_id,
            "loc": len(source.splitlines()),
            "lloc": _count_logical_lines(source),
            "hasSyntaxErrors": root.has_error,
            "rootNodeType": root.type,
            "nodeCount": _count_nodes(root),
            "classes": [],
            "functions": [],
            "imports": [],
        }

    # Post-proceso: clasificación funcional del módulo
    return _apply_module_type(result, file_path)


def _count_nodes(node) -> int:
    """Cuenta el total de nodos en el árbol, como señal mínima de tamaño/complejidad."""
    count = 1
    for child in node.children:
        count += _count_nodes(child)
    return count