"""
diagnose_worker.py — Diagnóstico standalone del worker de Python.

Uso:
    python tests/diagnose_worker.py "<ruta al archivo .java/.go/.rs a probar>"
"""

import json
import subprocess
import sys
from pathlib import Path

MAIN_PY = Path(__file__).resolve().parent.parent / "workers" / "python" / "main.py"


def main():
    if len(sys.argv) < 2:
        print("Uso: python tests/diagnose_worker.py <ruta_al_archivo>")
        sys.exit(1)

    file_path = sys.argv[1]
    print(f"[diagnose] main.py: {MAIN_PY} (existe: {MAIN_PY.exists()})")
    print(f"[diagnose] archivo a parsear: {file_path} (existe: {Path(file_path).exists()})")

    parse_req = json.dumps({
        "requestId": "diag-1",
        "command": "parse",
        "payload": {"filePath": file_path, "language": None, "fileHash": None},
    })
    shutdown_req = json.dumps({"requestId": "diag-2", "command": "shutdown", "payload": {}})
    stdin_data = parse_req + "\n" + shutdown_req + "\n"

    proc = subprocess.Popen(
        [sys.executable, str(MAIN_PY)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        stdout_data, stderr_data = proc.communicate(input=stdin_data, timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout_data, stderr_data = proc.communicate()
        print("[diagnose] EL WORKER NO RESPONDIO EN 20s (colgado, no crasheado) -> se lo mato.")

    print(f"\n[diagnose] CODIGO DE SALIDA: {proc.returncode}")
    print("\n[diagnose] ---- STDOUT (respuestas JSON) ----")
    print(stdout_data or "(vacio)")
    print("\n[diagnose] ---- STDERR (aca deberia estar el traceback si crasheo) ----")
    print(stderr_data or "(vacio)")


if __name__ == "__main__":
    main()