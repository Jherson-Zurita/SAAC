"""
test_analyze_project.py — Verificador de la lógica de escaneo, exclusiones y
cancelación de analyze_project.

Dado que cargo test en Windows con Tauri no puede ejecutar binarios de prueba
(STATUS_ENTRYPOINT_NOT_FOUND por DLLs de WebView2/Wry), este script valida:

1. Que el fixture mock_project tiene la estructura esperada.
2. Que `cargo check` compila sin errores la logica de analyze_project.
3. Que la logica de escaneo REAL de Rust (scan_project_directory, invocada vía el
   modo CLI `--scan-json` del binario compilado) produce los resultados esperados:
   inclusion, exclusion, filtro de tamano.
4. Que la cancelación REAL de analyze_project (CancellationRegistry +
   cancel_analysis, invocada vía el modo CLI `--analyze-project-json
   --cancel-after-ms`) efectivamente corta el análisis antes de completar todos
   los archivos, usando los workers reales de Node y Python.
"""

import os
import sys
import subprocess
import json
import shutil

MAX_FILE_SIZE_BYTES = 1_048_576  # 1 MB — usado solo para generar el fixture >1MB


def scan_mock_project(project_dir: str, src_tauri_dir: str):
    """
    Invoca el binario real de Rust (`tauri-app --scan-json <dir>`) para ejercitar
    la lógica REAL de `scan_project_directory`, incluyendo el motor completo de
    `.gitignore` de la crate `ignore`. No reimplementa nada de esa lógica en Python.
    """
    result = subprocess.run(
        ["cargo", "run", "--quiet", "--", "--scan-json", project_dir],
        cwd=src_tauri_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  [ERROR] --scan-json fallo (code {result.returncode}):\n{result.stderr}")
        sys.exit(1)

    # stdout puede tener output de compilación de cargo antes del JSON si el
    # binario no estaba pre-compilado; nos quedamos con la última línea no vacía,
    # que es la que imprime println! en main.rs.
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    if not lines:
        print(f"  [ERROR] --scan-json no produjo salida.\nstderr:\n{result.stderr}")
        sys.exit(1)

    try:
        data = json.loads(lines[-1])
    except json.JSONDecodeError as e:
        print(f"  [ERROR] No se pudo parsear la salida JSON de --scan-json: {e}\nSalida cruda:\n{result.stdout}")
        sys.exit(1)

    file_paths = data["filePaths"]
    skipped_files = data["skippedFiles"]
    node_count = data["nodeFilesCount"]
    python_count = data["pythonFilesCount"]

    return file_paths, skipped_files, node_count, python_count


def run_analyze_project_with_cancel(project_dir: str, src_tauri_dir: str, cancel_after_ms: int):
    """
    Invoca el binario real de Rust en modo `--analyze-project-json`, con
    cancelación diferida vía `--cancel-after-ms`. Ejercita el flujo COMPLETO
    de producción: workers Node/Python reales, chunking, CancellationRegistry,
    y el comando `cancel_analysis` tal cual lo invocaría el frontend.

    Devuelve el dict `ProjectAnalysisResult` parseado (con camelCase tal como
    lo serializa serde).
    """
    result = subprocess.run(
        [
            "cargo", "run", "--quiet", "--",
            "--analyze-project-json", project_dir,
            "--cancel-after-ms", str(cancel_after_ms),
        ],
        cwd=src_tauri_dir,
        capture_output=True,
        text=True,
        timeout=180,  # Los workers reales pueden tardar; margen generoso.
    )
    if result.returncode != 0:
        print(f"  [ERROR] --analyze-project-json fallo (code {result.returncode}):\n{result.stderr}")
        sys.exit(1)

    lines = [l for l in result.stdout.splitlines() if l.strip()]
    if not lines:
        print(f"  [ERROR] --analyze-project-json no produjo salida.\nstderr:\n{result.stderr}")
        sys.exit(1)

    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError as e:
        print(f"  [ERROR] No se pudo parsear la salida JSON: {e}\nSalida cruda:\n{result.stdout}")
        sys.exit(1)


def generate_cancel_fixture(fixture_dir: str, count_per_worker: int = 30):
    """
    Genera un fixture con suficientes archivos por worker (Python y Node) para
    forzar múltiples chunks de BATCH_CHUNK_SIZE=50, dejando una ventana real
    donde la cancelación pueda cortar entre el primer y el segundo chunk.

    count_per_worker=30 con BATCH_CHUNK_SIZE=50 da 1 chunk por worker — se
    ajusta desde el caller según el valor real de BATCH_CHUNK_SIZE si hace falta.
    """
    src_dir = os.path.join(fixture_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    for i in range(count_per_worker):
        # Contenido no trivial: suficientes líneas para que el parseo tome un
        # tiempo medible, en vez de un archivo vacío que se analiza al instante.
        py_content = "\n".join(f"def func_{i}_{j}():\n    return {i} + {j}" for j in range(20))
        with open(os.path.join(src_dir, f"mod_{i}.py"), "w", encoding="utf-8") as f:
            f.write(py_content + "\n")

        ts_content = "\n".join(f"export function func_{i}_{j}() {{ return {i} + {j}; }}" for j in range(20))
        with open(os.path.join(src_dir, f"mod_{i}.ts"), "w", encoding="utf-8") as f:
            f.write(ts_content + "\n")


def run_command(cmd, cwd=None):
    print(f"  Ejecutando: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return result


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de analyze_project (Escaneo + Build)")
    print("=" * 66)

    base_dir = os.path.abspath(os.path.dirname(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    fixture_dir = os.path.join(base_dir, "fixtures", "mock_project")
    src_tauri_dir = os.path.join(project_root, "src-tauri")

    # ─── Fase 1: Preparar fixtures ──────────────────────────────────
    print("\n[FASE 1] Preparando fixtures...")
    src_dir = os.path.join(fixture_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    huge_file_path = os.path.join(src_dir, "huge_file.py")
    print(f"  Generando archivo >1MB: {huge_file_path}")
    with open(huge_file_path, "w", encoding="utf-8") as f:
        f.write("#" * (MAX_FILE_SIZE_BYTES + 100))

    # Verificar que los archivos del fixture existen
    expected_files = {
        os.path.join(src_dir, "main.ts"): "node",
        os.path.join(src_dir, "helpers.js"): "node",
        os.path.join(src_dir, "utils.py"): "python",
    }
    for fpath, worker_type in expected_files.items():
        if not os.path.exists(fpath):
            print(f"  [ERROR] Falta archivo fixture: {fpath}")
            sys.exit(1)
    print("  [OK] Todos los archivos fixture existen.")

    # ─── Fase 2: Verificar compilacion Rust ──────────────────────────
    print("\n[FASE 2] Verificando compilacion de Rust (cargo check)...")
    result = run_command(["cargo", "check"], cwd=src_tauri_dir)
    if result.returncode != 0:
        print(f"  [ERROR] cargo check fallo:\n{result.stderr}")
        # Limpieza
        if os.path.exists(huge_file_path):
            os.remove(huge_file_path)
        sys.exit(1)
    print("  [OK] Compilacion de Rust exitosa.")

    # ─── Fase 3: Validar logica de escaneo ───────────────────────────
    print("\n[FASE 3] Validando logica de escaneo y exclusiones...")

    file_paths, skipped_files, node_count, python_count = scan_mock_project(fixture_dir, src_tauri_dir)

    # Normalizar paths para comparacion
    normalized = [p.replace("\\", "/") for p in file_paths]

    errors = []

    # 3.1 Cantidad de archivos procesables
    if len(file_paths) != 3:
        errors.append(f"Se esperaban 3 archivos procesables, se encontraron {len(file_paths)}: {normalized}")

    # 3.2 Clasificacion por worker
    if node_count != 2:
        errors.append(f"Se esperaban 2 archivos Node (main.ts, helpers.js), se encontraron {node_count}")
    if python_count != 1:
        errors.append(f"Se esperaba 1 archivo Python (utils.py), se encontraron {python_count}")

    # 3.3 Archivos esperados presentes
    for expected_suffix in ["src/main.ts", "src/helpers.js", "src/utils.py"]:
        if not any(p.endswith(expected_suffix) for p in normalized):
            errors.append(f"Falta archivo esperado: {expected_suffix}")

    # 3.4 Exclusion de node_modules
    if any("node_modules" in p for p in normalized):
        errors.append("Se encontro un archivo de node_modules/ que debio ser excluido")

    # 3.5 Exclusion por .gitignore (ignored.ts)
    if any("ignored.ts" in p for p in normalized):
        errors.append("Se encontro ignored.ts que debio ser excluido por .gitignore")

    # 3.6 Filtro de tamano (huge_file.py)
    if len(skipped_files) != 1:
        errors.append(f"Se esperaba 1 archivo saltado por tamano, se encontraron {len(skipped_files)}")
    elif skipped_files[0]["reason"] != "file_too_large":
        errors.append(f"Razon incorrecta de skip: {skipped_files[0]['reason']}")
    elif "huge_file.py" not in skipped_files[0]["filePath"]:
        errors.append(f"Archivo saltado incorrecto: {skipped_files[0]['filePath']}")

    if errors:
        print("  [ERRORES]:")
        for e in errors:
            print(f"    - {e}")
        if os.path.exists(huge_file_path):
            os.remove(huge_file_path)
        sys.exit(1)

    print(f"  [OK] Archivos procesables: {len(file_paths)} (Node={node_count}, Python={python_count})")
    print(f"  [OK] Archivos saltados: {len(skipped_files)} (huge_file.py por file_too_large)")
    print(f"  [OK] Exclusiones verificadas: node_modules, .gitignore (ignored.ts)")

    # ─── Limpieza fixture Fase 3 ─────────────────────────────────────
    print("\n[LIMPIEZA] Removiendo archivos temporales de Fase 3...")
    if os.path.exists(huge_file_path):
        os.remove(huge_file_path)
        print(f"  Removido: {huge_file_path}")

    # ─── Fase 4: Validar cancelación real de analyze_project ─────────
    print("\n[FASE 4] Validando cancelacion de analyze_project (--analyze-project-json)...")
    print("  NOTA: esta fase levanta los workers reales (Node y Python) y puede")
    print("  tardar mas que las fases anteriores.")

    cancel_fixture_dir = os.path.join(base_dir, "fixtures", "mock_project_cancel")
    # 30 archivos por worker: con BATCH_CHUNK_SIZE=50 cae en 1 chunk por worker,
    # así que se sube a 60 para garantizar 2 chunks por worker y una ventana
    # real de cancelación entre chunks.
    generate_cancel_fixture(cancel_fixture_dir, count_per_worker=60)

    cancel_after_ms = 150
    analysis = run_analyze_project_with_cancel(cancel_fixture_dir, src_tauri_dir, cancel_after_ms)

    cancel_errors = []

    total_files = analysis.get("totalFiles", 0)
    outcomes = analysis.get("outcomes", [])
    was_cancelled = analysis.get("cancelled", None)

    if was_cancelled is None:
        cancel_errors.append("Falta el campo 'cancelled' en ProjectAnalysisResult — ¿types.rs desactualizado?")
    elif was_cancelled is not True:
        cancel_errors.append(
            f"Se esperaba cancelled=true con --cancel-after-ms={cancel_after_ms}, "
            f"se obtuvo cancelled={was_cancelled}. Si esto fallo de forma consistente, "
            f"es probable que los workers hayan terminado ANTES de que se disparara la "
            f"cancelacion (el fixture de {cancel_fixture_dir} pudo procesarse muy rapido). "
            f"Prueba bajando cancel_after_ms o subiendo count_per_worker en el script."
        )

    if was_cancelled is True and len(outcomes) >= total_files:
        cancel_errors.append(
            f"cancelled=true pero outcomes tiene {len(outcomes)} de {total_files} archivos "
            f"totales — se esperaba un resultado PARCIAL (menos outcomes que el total)."
        )

    if cancel_errors:
        print("  [ERRORES]:")
        for e in cancel_errors:
            print(f"    - {e}")
        shutil.rmtree(cancel_fixture_dir, ignore_errors=True)
        sys.exit(1)

    print(f"  [OK] cancelled={was_cancelled}, outcomes={len(outcomes)}/{total_files} archivos totales")
    print(f"  [OK] La cancelacion cortó el analisis antes de completar todos los archivos")

    # ─── Limpieza fixture Fase 4 ─────────────────────────────────────
    shutil.rmtree(cancel_fixture_dir, ignore_errors=True)
    print(f"  Removido: {cancel_fixture_dir}")

    print("\n" + "=" * 66)
    print("   VERIFICACION DE ANALYZE_PROJECT COMPLETADA EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()