"""
patterns/__init__.py — Clasificador de rol funcional (ModuleType) para Python.

Analiza el nombre del archivo, la estructura del directorio, las clases,
funciones y decoradores para asignar un tipo funcional al módulo.

Referencia: §4.2.2, §4.5 de la especificación técnica SAAC.
"""

from __future__ import annotations

import os
import re
from typing import Any


# Tipo funcional asignado al módulo
ModuleType = str  # "service", "repository", "controller", "model", etc.

# ── Reglas de detección ordenadas por prioridad ──

_FILE_PATTERNS: list[tuple[re.Pattern, ModuleType]] = [
    # Tests (prioridad alta)
    (re.compile(r".*Test(s)?\.(py|java|go|rs|cs|kt)$|test_.*\.py$|.*_test\.py$|conftest\.py$", re.I), "test"),
    # Controllers / Endpoints
    (re.compile(r".*Controller\.(java|go|rs|cs|kt|swift)$|.*Resource\.(java|kt)$|views?\.py$|routes?\.py$|routers?\.py$|endpoints?\.py$", re.I), "controller"),
    # Services
    (re.compile(r".*Service(Impl)?\.(java|go|rs|cs|kt|swift)$|services?\.py$", re.I), "service"),
    # Repositories / DAOs
    (re.compile(r".*Repository(Impl)?\.(java|go|rs|cs|kt|swift)$|.*Dao\.(java|cs|kt)$|repositor(y|ies)\.py$|repos?\.py$|dal\.py$|managers?\.py$", re.I), "repository"),
    # Models / Entities / DTOs / Schemas
    (re.compile(r".*Dto\.(java|cs|kt|swift)$|.*Entity\.(java|cs|kt)$|models?\.py$|entities?\.py$|schemas?\.py$|serializers?\.py$", re.I), "model"),
    # General utilities / config
    (re.compile(r"utils?\.py$|helpers?\.py$|common\.py$", re.I), "util"),
    (re.compile(r"config\.py$|settings?\.py$|constants?\.py$|env\.py$|admin\.py$|urls\.py$", re.I), "config"),
    (re.compile(r"middlewares?\.py$|signals?\.py$", re.I), "middleware"),
    (re.compile(r"factories?\.py$", re.I), "factory"),
    (re.compile(r"tasks?\.py$|celery.*\.py$", re.I), "service"),
    (re.compile(r"forms?\.py$", re.I), "ui-component"),
]

_DIR_PATTERNS: list[tuple[re.Pattern, ModuleType]] = [
    (re.compile(r"tests?$|__tests__$", re.I), "test"),
    (re.compile(r"views?$|controllers?$|routers?$|endpoints?$", re.I), "controller"),
    (re.compile(r"services?$", re.I), "service"),
    (re.compile(r"repositor(y|ies)$|repos?$|dal$|data$", re.I), "repository"),
    (re.compile(r"models?$|entities$|domain$|schemas?$", re.I), "model"),
    (re.compile(r"serializers?$|dtos?$", re.I), "dto"),
    (re.compile(r"middlewares?$", re.I), "middleware"),
    (re.compile(r"config$|settings$", re.I), "config"),
    (re.compile(r"utils?$|helpers?$|lib$|common$|shared$", re.I), "util"),
    (re.compile(r"tasks?$|workers?$|jobs?$", re.I), "service"),
    (re.compile(r"templates?$|components?$|forms?$", re.I), "ui-component"),
]

# Decoradores de framework que revelan el rol del módulo
_DECORATOR_HINTS: dict[str, ModuleType] = {
    "app.route": "controller",
    "router.get": "controller",
    "router.post": "controller",
    "router.put": "controller",
    "router.delete": "controller",
    "api_view": "controller",
    "action": "controller",
    "task": "service",
    "shared_task": "service",
    "receiver": "middleware",
}

# Clases base que revelan el rol
_BASE_CLASS_HINTS: dict[str, ModuleType] = {
    "Model": "model",
    "models.Model": "model",
    "db.Model": "model",
    "Base": "model",
    "DeclarativeBase": "model",
    "BaseModel": "dto",         # Pydantic
    "Schema": "dto",            # Marshmallow
    "Serializer": "dto",
    "ModelSerializer": "dto",
    "APIView": "controller",
    "ViewSet": "controller",
    "ModelViewSet": "controller",
    "GenericAPIView": "controller",
    "TemplateView": "controller",
    "ListView": "controller",
    "DetailView": "controller",
    "CreateView": "controller",
    "UpdateView": "controller",
    "DeleteView": "controller",
    "TestCase": "test",
    "unittest.TestCase": "test",
}


def detect_module_type(
    file_path: str,
    classes: list[dict[str, Any]],
    functions: list[dict[str, Any]],
    imports: list[str],
) -> ModuleType:
    """
    Detecta el tipo funcional del módulo para clasificarlo en la taxonomía
    del AMG. Prioriza file patterns > dir patterns > decorator hints >
    base class hints > fallback heuristics.
    """
    normalized = file_path.replace("\\", "/")
    file_name = os.path.basename(normalized)
    dir_name = os.path.basename(os.path.dirname(normalized))

    # 1. Nombre de archivo
    for pattern, module_type in _FILE_PATTERNS:
        if pattern.search(file_name):
            return module_type

    # 2. Nombre del directorio padre
    for pattern, module_type in _DIR_PATTERNS:
        if pattern.search(dir_name):
            return module_type

    # 3. Decoradores en clases y funciones
    all_decorators: list[str] = []
    for cls in classes:
        all_decorators.extend(cls.get("decorators", []))
        for method in cls.get("methods", []):
            all_decorators.extend(method.get("decorators", []))
    for func in functions:
        all_decorators.extend(func.get("decorators", []))

    for dec in all_decorators:
        for hint, module_type in _DECORATOR_HINTS.items():
            if dec.startswith(hint):
                return module_type

    # 4. Clases base
    for cls in classes:
        for base in cls.get("extends", []):
            if base in _BASE_CLASS_HINTS:
                return _BASE_CLASS_HINTS[base]

    # 5. Heurísticas finales
    if file_name == "__init__.py":
        return "util"

    return "unknown"


# Mantener las funciones placeholder para smells/patterns futuros
def detect_smells(graph):
    return []

def detect_patterns(graph):
    return []
