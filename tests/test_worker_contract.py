#!/usr/bin/env python3
"""
test_worker_contract.py
=======================
Pruebas de contrato automatizadas para verificar que tanto el Worker de Node.js
como el Worker de Python se adhieren rigurosamente al protocolo JSON Lines
establecido en `shared/types.ts` y en la especificación técnica de SAAC.

Ejecución:
  python tests/test_worker_contract.py
"""

import sys
import os
import json
import subprocess
import asyncio
from typing import Any, Dict, List, Optional

# Colores para salida en terminal (sin caracteres especiales)
GREEN = ""
RED = ""
YELLOW = ""
BLUE = ""
RESET = ""

# Intentamos habilitar soporte de color ANSI en Windows
if sys.platform == "win32":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        GREEN = "\033[92m"
        RED = "\033[91m"
        YELLOW = "\033[93m"
        BLUE = "\033[94m"
        RESET = "\033[0m"
    except Exception:
        pass
else:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"


class ContractValidationError(Exception):
    """Excepción lanzada cuando hay un fallo en la validación del contrato."""
    pass


def validate_module_schema(module: Dict[str, Any], expected_lang: str):
    """Valida la estructura del objeto 'module' contra el contrato en shared/types.ts."""
    required_keys = ["id", "type", "name", "moduleType", "language", "loc", "lloc", "classes", "functions", "imports", "metrics"]
    for key in required_keys:
        if key not in module:
            raise ContractValidationError(f"Falta la clave requerida '{key}' en el objeto module.")
    
    if module["type"] != "module":
        raise ContractValidationError(f"El campo 'type' debe ser 'module', obtenido: {module['type']}")
    
    if module["language"] != expected_lang:
        raise ContractValidationError(f"El lenguaje del módulo debe ser '{expected_lang}', obtenido: {module['language']}")

    # Validar métricas
    metrics = module["metrics"]
    required_metrics = ["ce", "abstractness", "lcom4", "maintainabilityIndex", "cyclomaticComplexityAvg", "cyclomaticComplexityMax"]
    for metric in required_metrics:
        if metric not in metrics:
            raise ContractValidationError(f"Falta la métrica requerida '{metric}' en module.metrics.")
            
    # Validar colecciones básicas
    for field in ["classes", "functions", "imports"]:
        if not isinstance(module[field], list):
            raise ContractValidationError(f"El campo '{field}' en el módulo debe ser una lista.")


def validate_analysis_result(data: Dict[str, Any], expected_lang: str):
    """Valida la estructura de un WorkerAnalysisResult."""
    if "module" not in data:
        raise ContractValidationError("Falta el objeto 'module' en los datos del resultado.")
    validate_module_schema(data["module"], expected_lang)
    
    for key in ["dependencies", "invocations", "externalCalls"]:
        if key not in data:
            raise ContractValidationError(f"Falta la clave '{key}' en el resultado del análisis.")
        if not isinstance(data[key], list):
            raise ContractValidationError(f"El campo '{key}' debe ser una lista.")


async def run_worker_test(worker_name: str, cmd_args: List[str], cwd: str, file_to_parse: str, expected_lang: str):
    print(f"\n{BLUE}[{worker_name.upper()}] Iniciando pruebas de contrato...{RESET}")
    print(f"  Comando: {' '.join(cmd_args)}")
    print(f"  Directorio: {cwd}")
    
    # Iniciar el proceso
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd_args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd
        )
    except Exception as e:
        print(f"{RED}[{worker_name.upper()}] Error al iniciar el proceso: {e}{RESET}")
        return False

    async def read_line() -> str:
        line_bytes = await proc.stdout.readline()
        if not line_bytes:
            raise ContractValidationError("EOF inesperado en stdout del worker.")
        return line_bytes.decode("utf-8").strip()

    async def write_line(data: Dict[str, Any]):
        line = json.dumps(data) + "\n"
        proc.stdin.write(line.encode("utf-8"))
        await proc.stdin.drain()

    success = True
    try:
        # ==========================================
        # Prueba 1: Comando 'parse'
        # ==========================================
        print(f"  - Validando comando 'parse' para {file_to_parse}...")
        req_parse = {
            "requestId": "req-parse-1",
            "command": "parse",
            "payload": {
                "filePath": file_to_parse,
                "language": expected_lang
            }
        }
        await write_line(req_parse)
        
        response_line = await read_line()
        resp = json.loads(response_line)
        
        # Validar campos base del WorkerResponse
        if resp.get("requestId") != "req-parse-1":
            raise ContractValidationError(f"requestId inválido, esperado 'req-parse-1', obtenido {resp.get('requestId')}")
        if resp.get("status") != "success":
            raise ContractValidationError(f"status inválido, esperado 'success', obtenido '{resp.get('status')}', error: {resp.get('error')}")
        if "data" not in resp:
            raise ContractValidationError("Falta el campo 'data' en la respuesta exitosa.")
        
        # Validar el formato de los datos contra el contrato
        validate_analysis_result(resp["data"], expected_lang)
        print(f"    {GREEN}[OK] Comando 'parse' exitoso y validado.{RESET}")

        # ==========================================
        # Prueba 2: Comando 'analyze' (batch)
        # ==========================================
        print(f"  - Validando comando 'analyze' (lote)...")
        req_analyze = {
            "requestId": "req-analyze-1",
            "command": "analyze",
            "payload": {
                "files": [
                    {"filePath": file_to_parse, "language": expected_lang}
                ]
            }
        }
        await write_line(req_analyze)
        
        # Primero esperamos la respuesta parcial de progreso ("partial")
        response_line = await read_line()
        resp_partial = json.loads(response_line)
        if resp_partial.get("status") != "partial":
            raise ContractValidationError(f"Se esperaba una respuesta de progreso 'partial', obtenida: {resp_partial.get('status')}")
        if "progress" not in resp_partial:
            raise ContractValidationError("Falta el campo 'progress' en la respuesta parcial.")
        progress = resp_partial["progress"]
        if "processed" not in progress or "total" not in progress or "currentFile" not in progress:
            raise ContractValidationError(f"El campo 'progress' carece de las claves del contrato: {progress}")
        print(f"    {GREEN}[OK] Progreso parcial (partial) recibido y validado correctamente.{RESET}")

        # Ahora esperamos el resultado final del lote ("success")
        response_line = await read_line()
        resp_success = json.loads(response_line)
        if resp_success.get("status") != "success":
            raise ContractValidationError(f"Se esperaba 'success' para el lote, obtenido: {resp_success.get('status')}, error: {resp_success.get('error')}")
        if "data" not in resp_success:
            raise ContractValidationError("Falta el campo 'data' en el resultado exitoso del lote.")
        
        batch_data = resp_success["data"]
        if "results" not in batch_data:
            raise ContractValidationError("El payload de éxito de analyze debe contener 'results'.")
        if not isinstance(batch_data["results"], list):
            raise ContractValidationError("'results' debe ser un array.")
        
        results = batch_data["results"]
        if len(results) != 1:
            raise ContractValidationError(f"Se esperaba 1 resultado en el lote, obtenido: {len(results)}")
        
        file_result = results[0]
        if "filePath" not in file_result or "status" not in file_result:
            raise ContractValidationError(f"Faltan claves requeridas en el resultado del archivo: {file_result}")
        if file_result["status"] != "success":
            raise ContractValidationError(f"Se esperaba status 'success' para el archivo individual en lote, obtenido '{file_result['status']}', error: {file_result.get('errorMessage')}")
        if "result" not in file_result:
            raise ContractValidationError("Falta la clave 'result' en el resultado del archivo individual en lote.")
        
        # Validar el resultado de análisis del archivo en el lote
        validate_analysis_result(file_result["result"], expected_lang)
        print(f"    {GREEN}[OK] Comando 'analyze' exitoso y validado.{RESET}")

        # ==========================================
        # Prueba 3: Comando 'shutdown'
        # ==========================================
        print(f"  - Validando comando 'shutdown'...")
        req_shutdown = {
            "requestId": "req-shutdown-1",
            "command": "shutdown",
            "payload": {}
        }
        await write_line(req_shutdown)
        
        response_line = await read_line()
        resp_shutdown = json.loads(response_line)
        if resp_shutdown.get("requestId") != "req-shutdown-1":
            raise ContractValidationError(f"requestId de shutdown inválido: {resp_shutdown.get('requestId')}")
        if resp_shutdown.get("status") != "success":
            raise ContractValidationError(f"status de shutdown inválido: {resp_shutdown.get('status')}")
        print(f"    {GREEN}[OK] Comando 'shutdown' exitoso y validado.{RESET}")

        # Esperar a que el proceso termine ordenadamente
        try:
            await asyncio.wait_for(proc.wait(), timeout=3.0)
            print(f"    {GREEN}[OK] Proceso finalizado limpiamente.{RESET}")
        except asyncio.TimeoutError:
            print(f"    {YELLOW}[WARN] El proceso no se cerró a tiempo tras shutdown, finalizando...{RESET}")
            proc.kill()

    except ContractValidationError as ve:
        print(f"  {RED}[FAIL] Error de contrato en {worker_name}: {ve}{RESET}")
        success = False
        proc.kill()
    except Exception as e:
        print(f"  {RED}[FAIL] Error inesperado ejecutando pruebas de {worker_name}: {e}{RESET}")
        success = False
        proc.kill()

    # Consumir y mostrar logs de stderr si falló o para depuración
    _, stderr_bytes = await proc.communicate()
    if stderr_bytes and not success:
        print(f"  {YELLOW}Logs del stderr del worker:{RESET}")
        print(stderr_bytes.decode("utf-8", errors="replace"))

    return success


async def main():
    print(f"{BLUE}=================================================================={RESET}")
    print(f"{BLUE}  SAAC v2.0 - Verificador de Contrato JSON Lines de los Workers  {RESET}")
    print(f"{BLUE}=================================================================={RESET}")

    # Ubicaciones del proyecto
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # Determinar ejecutables y comandos
    # Para Node: usaremos 'node' con el archivo compilado dist/index.js
    # (spawnear npx sin shell=True en windows falla, node directo es lo más seguro).
    node_worker_dir = os.path.join(root_dir, "workers", "node")
    node_cmd = ["node", "dist/index.js"]
    
    # Para Python:
    python_worker_dir = os.path.join(root_dir, "workers", "python")
    py_cmd = [sys.executable, "main.py"]

    # Rutas absolutas a los archivos que se van a parsear
    node_test_file = os.path.join(root_dir, "workers", "node", "src", "index.ts")
    py_test_file = os.path.join(root_dir, "workers", "python", "main.py")

    node_ok = await run_worker_test("Node Worker", node_cmd, node_worker_dir, node_test_file, "typescript")
    py_ok = await run_worker_test("Python Worker", py_cmd, python_worker_dir, py_test_file, "python")

    print(f"\n{BLUE}=================================================================={RESET}")
    if node_ok and py_ok:
        print(f"{GREEN}   CONTRATO COMPLETO VERIFICADO EXITOSAMENTE (Ambos Workers Ok)   {RESET}")
        print(f"{BLUE}=================================================================={RESET}")
        sys.exit(0)
    else:
        print(f"{RED}   ERROR: Fallos detectados en las validaciones de contrato.     {RESET}")
        print(f"{BLUE}=================================================================={RESET}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
