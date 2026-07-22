"""
test_supplementary_diagrams.py — Verificador de la generación de Diagramas Suplementarios Adicionales.

Valida que el backend de SAAC v2.0 genera en c4Models.componentDiagrams:
1. "supplementary:package-diagram" (Diagrama de Paquetes UML)
2. "supplementary:inheritance-tree" (Árbol de Herencia Global)
3. "supplementary:er-diagram" (Diagrama Entidad-Relación de Modelos)
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


def generate_supplementary_fixture(fixture_dir: str):
    """Genera un proyecto sintético con paquetes, clases jerárquicas y modelos de datos."""
    os.makedirs(fixture_dir, exist_ok=True)

    # --- models (para ER diagram y herencia) ---
    models_dir = os.path.join(fixture_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    with open(os.path.join(models_dir, "base_model.py"), "w", encoding="utf-8") as f:
        f.write(
            "class BaseModel:\n"
            "    def __init__(self):\n"
            "        self.id = 1\n"
        )
    with open(os.path.join(models_dir, "user_model.py"), "w", encoding="utf-8") as f:
        f.write(
            "from models.base_model import BaseModel\n\n"
            "class UserModel(BaseModel):\n"
            "    def __init__(self, name):\n"
            "        super().__init__()\n"
            "        self.name = name\n"
        )

    # --- services (para paquete e imports cruzados) ---
    svc_dir = os.path.join(fixture_dir, "services")
    os.makedirs(svc_dir, exist_ok=True)
    with open(os.path.join(svc_dir, "user_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "from models.user_model import UserModel\n\n"
            "class UserService:\n"
            "    def create_user(self):\n"
            "        return UserModel('test')\n"
        )


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Diagramas Suplementarios Adicionales")
    print("=" * 66)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_tauri_dir = os.path.join(os.path.dirname(base_dir), "src-tauri")
    if not os.path.isdir(src_tauri_dir):
        src_tauri_dir = os.path.join(base_dir, "..", "src-tauri")

    fixture_dir = os.path.join(base_dir, "fixtures", "mock_supplementary_project")

    # ─── Fase 1: Preparar fixture ────────────────────────────────────
    print("\n[FASE 1] Preparando fixture con paquetes y jerarquías...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    generate_supplementary_fixture(fixture_dir)
    print("  [OK] Fixture suplementario creado.")

    # ─── Fase 2: Ejecutar análisis ───────────────────────────────────
    print("\n[FASE 2] Ejecutando analyze_project...")
    analysis = run_analyze_project(fixture_dir, src_tauri_dir)

    amg = analysis.get("amg")
    if not amg:
        print("  [ERROR] No se generó el AMG en el resultado del análisis.")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    c4_models = amg.get("c4Models", {})
    component_diagrams = c4_models.get("componentDiagrams", {})

    print(f"  [OK] Análisis completado.")
    print(f"       Claves en componentDiagrams: {list(component_diagrams.keys())}")

    # ─── Fase 3: Validar diagramas suplementarios ────────────────────
    print("\n[FASE 3] Validando diagramas suplementarios adicionados...")
    errors = []

    # 3.1 Package Diagram
    pkg_diag = component_diagrams.get("supplementary:package-diagram")
    if not pkg_diag:
        errors.append("No se encontró 'supplementary:package-diagram' en componentDiagrams")
    else:
        print(f"  [OK] Package Diagram: {len(pkg_diag.get('nodes', []))} paquetes, {len(pkg_diag.get('edges', []))} aristas")

    # 3.2 Inheritance Tree
    inh_diag = component_diagrams.get("supplementary:inheritance-tree")
    if not inh_diag:
        errors.append("No se encontró 'supplementary:inheritance-tree' en componentDiagrams")
    else:
        print(f"  [OK] Inheritance Tree: {len(inh_diag.get('nodes', []))} clases, {len(inh_diag.get('edges', []))} herencias")

    # 3.3 ER Diagram
    er_diag = component_diagrams.get("supplementary:er-diagram")
    if not er_diag:
        errors.append("No se encontró 'supplementary:er-diagram' en componentDiagrams")
    else:
        print(f"  [OK] ER Diagram: {len(er_diag.get('nodes', []))} entidades")

    if errors:
        print("\n  [ERRORES EN DIAGRAMAS SUPLEMENTARIOS]:")
        for e in errors:
            print(f"    - {e}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    # ─── Limpieza ────────────────────────────────────────────────────
    shutil.rmtree(fixture_dir, ignore_errors=True)
    print(f"\n[LIMPIEZA] Fixture suplementario removido.")

    print("\n" + "=" * 66)
    print("   DIAGRAMAS SUPLEMENTARIOS VERIFICADOS EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()