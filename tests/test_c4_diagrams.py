"""
test_c4_diagrams.py — Verificador de la generación de Diagramas C4 (Niveles 1, 2 y 3) y suplementarios.

Valida que el pipeline de SAAC v2.0 genera correctamente:
1. Actores (User, Admin User)
2. Sistemas Externos (HTTP API, Database)
3. Contenedores (Frontend, Backend)
4. Diagrama de Contexto (Nivel 1)
5. Diagrama de Contenedores (Nivel 2)
6. Diagrama de Componentes (Nivel 3)
"""

import os
import sys
import subprocess
import json
import shutil


def run_analyze_project(project_dir: str, src_tauri_dir: str):
    """Ejecuta el binario Rust en modo --analyze-project-json."""
    result = subprocess.run(
        [
            "cargo", "run", "--quiet", "--",
            "--analyze-project-json", project_dir,
        ],
        cwd=src_tauri_dir,
        capture_output=True,
        text=True,
        timeout=180,
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


def generate_c4_fixture(fixture_dir: str):
    """Genera un proyecto sintético con controladores, servicios y llamadas externas."""
    os.makedirs(fixture_dir, exist_ok=True)

    # controllers / admin
    admin_dir = os.path.join(fixture_dir, "controllers", "admin")
    os.makedirs(admin_dir, exist_ok=True)
    with open(os.path.join(admin_dir, "admin_controller.py"), "w", encoding="utf-8") as f:
        f.write(
            "import urllib.request\n\n"
            "class AdminController:\n"
            "    def fetch_data(self):\n"
            "        return urllib.request.urlopen('http://api.external.com').read()\n"
        )

    # services
    svc_dir = os.path.join(fixture_dir, "services")
    os.makedirs(svc_dir, exist_ok=True)
    with open(os.path.join(svc_dir, "user_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "from controllers.admin.admin_controller import AdminController\n\n"
            "class UserService:\n"
            "    def get_info(self):\n"
            "        return AdminController().fetch_data()\n"
        )


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Generación de Diagramas C4")
    print("=" * 66)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_tauri_dir = os.path.join(os.path.dirname(base_dir), "src-tauri")
    if not os.path.isdir(src_tauri_dir):
        src_tauri_dir = os.path.join(base_dir, "..", "src-tauri")

    fixture_dir = os.path.join(base_dir, "fixtures", "mock_c4_project")

    # ─── Fase 1: Preparar fixture ────────────────────────────────────
    print("\n[FASE 1] Preparando fixture con llamadas externas y estructuras C4...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    generate_c4_fixture(fixture_dir)
    print("  [OK] Fixture C4 creado.")

    # ─── Fase 2: Ejecutar análisis ───────────────────────────────────
    print("\n[FASE 2] Ejecutando analyze_project...")
    analysis = run_analyze_project(fixture_dir, src_tauri_dir)

    amg = analysis.get("amg")
    if not amg:
        print("  [ERROR] No se generó el AMG en el resultado del análisis.")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    c4_models = amg.get("c4Models", {})
    actors = amg.get("actors", [])
    external_systems = amg.get("externalSystems", [])
    containers = amg.get("containers", [])

    print(f"  [OK] Análisis completado.")
    print(f"       Actores inferidos: {len(actors)}")
    print(f"       Sistemas Externos: {len(external_systems)}")
    print(f"       Contenedores: {len(containers)}")

    # ─── Debug: imprimir elementos ──────────────────────────────────
    print("\n[DEBUG] Elementos C4:")
    for a in actors:
        print(f"  - Actor: {a['name']} ({a['role']})")
    for es in external_systems:
        print(f"  - ExternalSystem: {es['name']} ({es['protocol']})")
    for c in containers:
        print(f"  - Container: {c['name']} ({c['technology']})")

    context_diagram = c4_models.get("contextDiagram", {})
    container_diagram = c4_models.get("containerDiagram", {})
    component_diagrams = c4_models.get("componentDiagrams", {})

    print(f"\n[DEBUG] Diagramas C4 generados:")
    print(f"  - Context Diagram: {len(context_diagram.get('nodes', []))} nodos, {len(context_diagram.get('edges', []))} aristas")
    print(f"  - Container Diagram: {len(container_diagram.get('nodes', []))} nodos, {len(container_diagram.get('edges', []))} aristas")
    print(f"  - Component Diagrams keys: {list(component_diagrams.keys())}")

    # ─── Fase 3: Validaciones ────────────────────────────────────────
    print("\n[FASE 3] Validando contenido de los diagramas C4...")
    errors = []

    # 3.1 Actores
    if not actors:
        errors.append("No se inferió ningún Actor en el AMG")

    # 3.2 Contenedores
    if not containers:
        errors.append("No se inferió ningún Contenedor en el AMG")

    # 3.3 Diagrama de Contexto (Nivel 1)
    if not context_diagram.get("nodes"):
        errors.append("El diagrama de contexto (Nivel 1) está vacío")

    # 3.4 Diagrama de Contenedores (Nivel 2)
    if not container_diagram.get("nodes"):
        errors.append("El diagrama de contenedores (Nivel 2) está vacío")

    # 3.5 Diagrama de Componentes (Nivel 3)
    if not component_diagrams:
        errors.append("No se generaron diagramas de componentes (Nivel 3)")

    if errors:
        print("\n  [ERRORES C4]:")
        for e in errors:
            print(f"    - {e}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    # ─── Limpieza ────────────────────────────────────────────────────
    shutil.rmtree(fixture_dir, ignore_errors=True)
    print(f"\n[LIMPIEZA] Fixture C4 removido.")

    print("\n" + "=" * 66)
    print("   GENERACION DE DIAGRAMAS C4 VERIFICADA EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()
