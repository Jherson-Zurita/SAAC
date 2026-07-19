"""
language_registry.py — Mapeo entre extensión de archivo, identificador de
lenguaje de SAAC, y el nombre que espera `tree_sitter_language_pack.get_parser`.

Cubre los 7 lenguajes de la Capa 4 (§2.2 de la especificación): Python, Java,
Kotlin, C#, Swift, Go y Rust. TypeScript/JavaScript se excluyen a propósito:
esos los cubre el worker de Node (workers/node/src/typescript.ts).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LanguageSpec:
    # Identificador interno de SAAC (coincide con el campo `language` que
    # llega en ParsePayload desde el backend de Rust).
    saac_id: str
    # Nombre que espera tree_sitter_language_pack.get_parser(name=...).
    ts_name: str
    extensions: tuple[str, ...]


SUPPORTED_LANGUAGES: tuple[LanguageSpec, ...] = (
    LanguageSpec("python", "python", (".py", ".pyi")),
    LanguageSpec("java", "java", (".java",)),
    LanguageSpec("kotlin", "kotlin", (".kt", ".kts")),
    LanguageSpec("csharp", "csharp", (".cs",)),
    LanguageSpec("swift", "swift", (".swift",)),
    LanguageSpec("go", "go", (".go",)),
    LanguageSpec("rust", "rust", (".rs",)),
)

_BY_EXTENSION: dict[str, LanguageSpec] = {
    ext: spec for spec in SUPPORTED_LANGUAGES for ext in spec.extensions
}

_BY_SAAC_ID: dict[str, LanguageSpec] = {spec.saac_id: spec for spec in SUPPORTED_LANGUAGES}


def resolve_by_extension(file_path: str) -> LanguageSpec | None:
    """Determina el lenguaje a partir de la extensión del archivo."""
    for ext, spec in _BY_EXTENSION.items():
        if file_path.endswith(ext):
            return spec
    return None


def resolve_by_saac_id(language: str) -> LanguageSpec | None:
    """Determina el lenguaje a partir del identificador enviado en el payload."""
    return _BY_SAAC_ID.get(language)


def resolve(file_path: str, language_hint: str | None) -> LanguageSpec | None:
    """
    Resuelve el lenguaje priorizando el hint explícito del payload (más
    confiable, ya que el backend de Rust ya hizo esa detección una vez) y
    usando la extensión del archivo como fallback si el hint no coincide
    con ningún lenguaje soportado.
    """
    if language_hint:
        spec = resolve_by_saac_id(language_hint)
        if spec:
            return spec
    return resolve_by_extension(file_path)