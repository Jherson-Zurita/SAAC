"""
main.py — Orquestador del worker de Python (Capa 4) para SAAC.

Protocolo: JSON Lines sobre stdin/stdout, idéntico al usado por el worker de
Node (workers/node/src/index.ts). Los logs de depuración van a stderr para no
contaminar el stream de respuestas JSON que consume node_worker.rs.

Comandos soportados:
  - parse:    analiza un único archivo.
  - analyze:  analiza un batch de archivos, emitiendo progreso parcial
              (status: "partial") tras cada archivo completado.
  - shutdown: confirma y termina el proceso de forma ordenada.

Diseño deliberado:
  - Un único archivo con sintaxis inválida NO debe tumbar el batch completo:
    se reporta con AnalysisFileStatus.PARSE_ERROR y se continúa.
  - Cualquier excepción no anticipada durante el procesamiento de una
    request se captura en el nivel más externo posible y se traduce a una
    WorkerResponse de error, nunca en un traceback crudo hacia stdout (eso
    rompería el framing JSON Lines que espera node_worker.rs).
"""

from __future__ import annotations

import asyncio
import sys
import traceback
from typing import Any

from protocol import (
    AnalysisFileStatus,
    WorkerCommand,
    WorkerProgressPayload,
    WorkerRequest,
    make_error_response,
    make_partial_response,
    make_success_response,
)
from language_registry import resolve as resolve_language
from parsers import parse_file


def log(message: str) -> None:
    """Log de depuración a stderr — nunca a stdout (ver nota de protocolo)."""
    print(f"[worker-python] {message}", file=sys.stderr, flush=True)


def write_response(response) -> None:
    """
    Escribe una WorkerResponse como una línea JSON en stdout, con flush
    inmediato. El flush es obligatorio: sin él, node_worker.rs (que lee con
    BufReader::lines()) puede quedar esperando datos que están bufferizados
    del lado de Python y nunca llegan a tiempo, disparando falsos timeouts.
    """
    sys.stdout.write(response.to_json_line() + "\n")
    sys.stdout.flush()


async def handle_parse(request: WorkerRequest) -> None:
    """
    Procesa el comando `parse` para un único archivo y escribe la respuesta.
    Cualquier error (archivo no encontrado, lenguaje no soportado, sintaxis
    inválida) se traduce a un WorkerResponse de error explícito, nunca a una
    excepción sin capturar.
    """
    try:
        payload = request.payload
        file_path = payload["filePath"]
        language_hint = payload.get("language")

        spec = resolve_language(file_path, language_hint)
        if spec is None:
            write_response(
                make_error_response(
                    request.requestId,
                    f"Lenguaje no soportado para el archivo: {file_path}",
                )
            )
            return

        result = await asyncio.to_thread(parse_file, file_path, spec)
        write_response(make_success_response(request.requestId, result))

    except FileNotFoundError:
        write_response(
            make_error_response(
                request.requestId,
                f"Archivo no encontrado: {request.payload.get('filePath')}",
            )
        )
    except Exception as exc:  # noqa: BLE001 — frontera del worker, debe capturar todo
        log(f"Error inesperado en parse (requestId={request.requestId}): {exc}")
        log(traceback.format_exc())
        write_response(make_error_response(request.requestId, f"parse_error: {exc}"))


async def handle_analyze(request: WorkerRequest) -> None:
    """
    Procesa el comando `analyze` (batch de archivos), emitiendo un evento de
    progreso parcial tras completar cada archivo. Un archivo individual que
    falle (sintaxis inválida, lenguaje no soportado) se reporta con su
    propio estado de error dentro del arreglo de resultados, sin abortar el
    resto del batch — mismo principio que ya se aplicó en node_worker.rs
    para timeouts/crashes: un fallo aislado no debe tumbar el pipeline.
    """
    files: list[dict[str, Any]] = request.payload.get("files", [])
    total = len(files)
    results: list[dict[str, Any]] = []

    for i, file in enumerate(files, start=1):
        file_path = file.get("filePath", "") if isinstance(file, dict) else ""
        file_result: dict[str, Any] = {"filePath": file_path}
        try:
            if not file_path:
                raise ValueError("Entrada de batch sin filePath")

            language_hint = file.get("language") if isinstance(file, dict) else None
            spec = resolve_language(file_path, language_hint)
            if spec is None:
                file_result["status"] = AnalysisFileStatus.PARSE_ERROR.value
                file_result["errorMessage"] = "Lenguaje no soportado"
            else:
                parsed = await asyncio.to_thread(parse_file, file_path, spec)
                file_result["status"] = AnalysisFileStatus.SUCCESS.value
                file_result["result"] = parsed
        except FileNotFoundError:
            file_result["status"] = AnalysisFileStatus.PARSE_ERROR.value
            file_result["errorMessage"] = "Archivo no encontrado"
        except Exception as exc:  # noqa: BLE001
            log(f"Error procesando {file_path} en batch: {exc}")
            file_result["status"] = AnalysisFileStatus.PARSE_ERROR.value
            file_result["errorMessage"] = str(exc)

        results.append(file_result)

        # Progreso parcial tras cada archivo, para que la UI de Tauri pueda
        # mostrar una barra de avance en batches grandes.
        write_response(
            make_partial_response(
                request.requestId,
                WorkerProgressPayload(processed=i, total=total, currentFile=file_path),
            )
        )

    write_response(make_success_response(request.requestId, {"results": results}))


async def handle_shutdown(request: WorkerRequest) -> bool:
    """
    Confirma el shutdown ordenado. Devuelve True para señalar al loop
    principal que debe terminar tras enviar la confirmación.
    """
    write_response(make_success_response(request.requestId, {"acknowledged": True}))
    log("Shutdown confirmado, terminando el proceso worker")
    return True


async def dispatch(raw_line: str) -> bool:
    """
    Parsea una línea de stdin como WorkerRequest y despacha al handler
    correspondiente. Devuelve True si el loop principal debe terminar
    (comando shutdown procesado con éxito).

    Una línea que no es JSON válido, o que carece de un `requestId`, no
    puede generar una WorkerResponse correlacionada (no hay a quién
    responder), así que se loguea a stderr y se descarta sin abortar el
    loop — igual que el worker de Node trata líneas de stdout malformadas.
    """
    line = raw_line.strip()
    if not line:
        return False

    try:
        import json

        raw = json.loads(line)
        request = WorkerRequest.from_json(raw)
    except Exception as exc:  # noqa: BLE001
        log(f"Línea de stdin inválida, descartada: {exc!r} | raw={raw_line!r}")
        return False

    try:
        command = WorkerCommand(request.command)
    except ValueError:
        write_response(
            make_error_response(request.requestId, f"Comando no soportado: {request.command}")
        )
        return False

    if command is WorkerCommand.PARSE:
        await handle_parse(request)
        return False
    elif command is WorkerCommand.ANALYZE:
        await handle_analyze(request)
        return False
    elif command is WorkerCommand.SHUTDOWN:
        return await handle_shutdown(request)

    return False


async def main() -> None:
    log("Worker Python iniciado, esperando requests en stdin")

    #loop = asyncio.get_event_loop()
    #reader = asyncio.StreamReader()
    #protocol = asyncio.StreamReaderProtocol(reader)
    #await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        #raw_line = await reader.readline()
        raw_line = await asyncio.to_thread(sys.stdin.buffer.readline)
        if not raw_line:
            # EOF en stdin: el proceso padre (Rust) cerró el pipe, típicamente
            # al terminar la aplicación sin pasar por el comando `shutdown`
            # explícito. Se termina limpiamente en vez de hacer polling
            # infinito sobre un stream cerrado.
            log("stdin cerrado (EOF), terminando el worker")
            break

        should_exit = await dispatch(raw_line.decode("utf-8", errors="replace"))
        if should_exit:
            break


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Worker interrumpido (KeyboardInterrupt)")
        sys.exit(0)
