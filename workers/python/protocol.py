"""
protocol.py — Tipos del protocolo JSON Lines compartido entre el backend de
Rust (Tauri Core) y el worker de Python.

Espejo intencional (sin import cruzado) de los tipos usados en:
  - shared/types.ts (fuente de verdad canónica del monorepo)
  - workers/node/src/index.ts (mismo protocolo, implementado en Node)
  - src-tauri/src/workers/node_worker.rs (structs serde equivalentes)

Se usan dataclasses + un encoder JSON explícito en vez de una librería de
validación externa (pydantic, etc.) para no añadir una dependencia pesada
a un worker cuyo trabajo principal es CPU-bound (parsing), no I/O de red.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Literal


class WorkerCommand(str, Enum):
    PARSE = "parse"
    ANALYZE = "analyze"
    SHUTDOWN = "shutdown"


class WorkerStatus(str, Enum):
    PARTIAL = "partial"
    SUCCESS = "success"
    ERROR = "error"


# Espejo de AnalysisFileStatus en node_worker.rs — mismos valores, para que
# el backend de Rust pueda tratar ambos workers (Node y Python) de forma
# uniforme sin distinguir el origen del error.
class AnalysisFileStatus(str, Enum):
    SUCCESS = "success"
    TIMEOUT = "timeout"
    WORKER_CRASHED = "worker_crashed"
    PARSE_ERROR = "parse_error"
    WORKER_UNAVAILABLE = "worker_unavailable"


@dataclass
class ParsePayload:
    filePath: str
    language: str | None = None
    fileHash: str | None = None


@dataclass
class AnalyzePayload:
    files: list[ParsePayload]


@dataclass
class WorkerRequest:
    requestId: str
    command: str  # valor de WorkerCommand
    payload: dict[str, Any]

    @staticmethod
    def from_json(raw: dict[str, Any]) -> "WorkerRequest":
        return WorkerRequest(
            requestId=raw["requestId"],
            command=raw["command"],
            payload=raw.get("payload", {}) or {},
        )


@dataclass
class WorkerResponse:
    requestId: str
    status: str  # valor de WorkerStatus
    data: dict[str, Any] | None = None
    error: str | None = None
    progress: dict[str, Any] | None = None

    def to_json_line(self) -> str:
        # `default=str` evita que un tipo no serializable inesperado tumbe
        # la escritura completa de la línea; se prefiere degradar a texto
        # sobre no poder responder al backend de Rust en absoluto.
        return json.dumps(asdict(self), default=str, ensure_ascii=False)


@dataclass
class WorkerProgressPayload:
    processed: int
    total: int
    currentFile: str | None = None


def make_error_response(request_id: str, message: str) -> WorkerResponse:
    return WorkerResponse(requestId=request_id, status=WorkerStatus.ERROR.value, error=message)


def make_success_response(request_id: str, data: dict[str, Any]) -> WorkerResponse:
    return WorkerResponse(requestId=request_id, status=WorkerStatus.SUCCESS.value, data=data)


def make_partial_response(request_id: str, progress: WorkerProgressPayload) -> WorkerResponse:
    return WorkerResponse(
        requestId=request_id,
        status=WorkerStatus.PARTIAL.value,
        progress=asdict(progress),
    )
