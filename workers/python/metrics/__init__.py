"""
metrics/__init__.py — Re-exporta las funciones de métricas desde sus submódulos.
"""

from metrics.complexity import cyclomatic_complexity, cognitive_complexity
from metrics.cohesion import calculate_lcom4, calculate_class_metrics

__all__ = [
    "cyclomatic_complexity",
    "cognitive_complexity",
    "calculate_lcom4",
    "calculate_class_metrics",
]
