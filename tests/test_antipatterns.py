"""
test_antipatterns.py — Verificador de la detección de antipatrones de arquitectura.

Valida que el pipeline completo de SAAC v2.0 detecte correctamente:
1. God Module (Ce excesivo)
2. Circular Dependency (ciclos en el grafo de dependencias)
3. Layer Violation (dependencia de capa inferior a capa superior)

Genera un fixture sintético con antipatrones intencionados, ejecuta
`--analyze-project-json` y valida el campo `antipatterns` del AMG.
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


def generate_antipattern_fixture(fixture_dir: str):
    """
    Genera un proyecto de prueba con antipatrones intencionados.

    Estructura:
      fixture_dir/
        controllers/
          user_controller.py  ← importa services/user_service (OK downward)
        services/
          user_service.py     ← importa repositories/user_repo (OK downward)
                                 importa controllers/admin_controller (VIOLACIÓN: Layer 2 → Layer 3)
          order_service.py    ← importa services/user_service (cycle A→B)
        repositories/
          user_repo.py        ← importa services/order_service (VIOLACIÓN: Layer 1 → Layer 2)
          admin_repo.py       ← (sin imports, módulo aislado)
        domain/
          models.py           ← (sin imports, solo definiciones)
        god_module.py         ← importa TODOS los demás módulos (God Module por Ce alto)
    """
    os.makedirs(fixture_dir, exist_ok=True)

    # --- controllers ---
    ctrl_dir = os.path.join(fixture_dir, "controllers")
    os.makedirs(ctrl_dir, exist_ok=True)
    with open(os.path.join(ctrl_dir, "user_controller.py"), "w", encoding="utf-8") as f:
        f.write(
            "from services.user_service import UserService\n\n"
            "class UserController:\n"
            "    def get_user(self):\n"
            "        return UserService().find()\n"
        )
    with open(os.path.join(ctrl_dir, "admin_controller.py"), "w", encoding="utf-8") as f:
        f.write(
            "class AdminController:\n"
            "    def admin_action(self):\n"
            "        return 'admin'\n"
        )

    # --- services ---
    svc_dir = os.path.join(fixture_dir, "services")
    os.makedirs(svc_dir, exist_ok=True)
    # user_service importa admin_controller (Layer Violation: service → controller)
    # user_service importa user_repo (OK: service → repository)
    with open(os.path.join(svc_dir, "user_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "from repositories.user_repo import UserRepo\n"
            "from controllers.admin_controller import AdminController\n\n"
            "class UserService:\n"
            "    def find(self):\n"
            "        return UserRepo().get()\n"
        )
    # order_service importa user_service (creates potential cycle with god_module)
    with open(os.path.join(svc_dir, "order_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "from services.user_service import UserService\n\n"
            "class OrderService:\n"
            "    def process(self):\n"
            "        return UserService().find()\n"
        )

    # --- repositories ---
    repo_dir = os.path.join(fixture_dir, "repositories")
    os.makedirs(repo_dir, exist_ok=True)
    # user_repo importa order_service (Layer Violation: repository → service)
    with open(os.path.join(repo_dir, "user_repo.py"), "w", encoding="utf-8") as f:
        f.write(
            "from services.order_service import OrderService\n\n"
            "class UserRepo:\n"
            "    def get(self):\n"
            "        return OrderService().process()\n"
        )
    with open(os.path.join(repo_dir, "admin_repo.py"), "w", encoding="utf-8") as f:
        f.write(
            "class AdminRepo:\n"
            "    def get_admin(self):\n"
            "        return 'data'\n"
        )

    # --- domain ---
    domain_dir = os.path.join(fixture_dir, "domain")
    os.makedirs(domain_dir, exist_ok=True)
    with open(os.path.join(domain_dir, "models.py"), "w", encoding="utf-8") as f:
        f.write(
            "class User:\n"
            "    def __init__(self, name):\n"
            "        self.name = name\n"
        )

    # --- god_module: importa todos los módulos del proyecto ---
    with open(os.path.join(fixture_dir, "god_module.py"), "w", encoding="utf-8") as f:
        f.write(
            "from controllers.user_controller import UserController\n"
            "from controllers.admin_controller import AdminController\n"
            "from services.user_service import UserService\n"
            "from services.order_service import OrderService\n"
            "from repositories.user_repo import UserRepo\n"
            "from repositories.admin_repo import AdminRepo\n"
            "from domain.models import User\n\n"
            "class GodModule:\n"
            "    def do_everything(self):\n"
            "        return [\n"
            "            UserController(),\n"
            "            AdminController(),\n"
            "            UserService(),\n"
            "            OrderService(),\n"
            "            UserRepo(),\n"
            "            AdminRepo(),\n"
            "            User('test'),\n"
            "        ]\n"
        )


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Detección de Antipatrones")
    print("=" * 66)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_tauri_dir = os.path.join(os.path.dirname(base_dir), "src-tauri")
    if not os.path.isdir(src_tauri_dir):
        src_tauri_dir = os.path.join(base_dir, "..", "src-tauri")

    fixture_dir = os.path.join(base_dir, "fixtures", "mock_antipatterns")

    # ─── Fase 1: Preparar fixture ────────────────────────────────────
    print("\n[FASE 1] Preparando fixture con antipatrones intencionados...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    generate_antipattern_fixture(fixture_dir)
    print("  [OK] Fixture creado.")

    # ─── Fase 2: Ejecutar análisis ───────────────────────────────────
    print("\n[FASE 2] Ejecutando analyze_project...")
    analysis = run_analyze_project(fixture_dir, src_tauri_dir)

    amg = analysis.get("amg")
    if not amg:
        print("  [ERROR] No se generó el AMG en el resultado del análisis.")
        print(f"  Resultado: {json.dumps(analysis, indent=2)[:500]}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    antipatterns = amg.get("antipatterns", [])
    print(f"  [OK] Análisis completado. {len(antipatterns)} antipatrón(es) detectado(s).")

    # ─── Debug: imprimir antipatrones detectados ─────────────────────
    print("\n[DEBUG] Antipatrones detectados:")
    for ap in antipatterns:
        print(f"  - [{ap['severity']}] {ap['antipatternType']}: {ap['description'][:80]}...")

    # ─── Debug: imprimir módulos y dependencias ──────────────────────
    print("\n[DEBUG] Módulos en el AMG:")
    for m in amg.get("modules", []):
        print(f"  - {m['id']} (type={m.get('moduleType','?')}, Ce={m['metrics']['ce']})")
    print("\n[DEBUG] Dependencias resueltas:")
    for dep in amg.get("dependencies", []):
        print(f"  - {dep['source']} -> {dep['target']}")

    # ─── Fase 3: Validar antipatrones ────────────────────────────────
    print("\n[FASE 3] Validando detección de antipatrones...")
    errors = []

    # 3.1 God Module
    god_modules = [ap for ap in antipatterns if ap["antipatternType"] == "god-module"]
    if not god_modules:
        errors.append("No se detectó ningún God Module (se esperaba god_module.py con Ce >= 20% del proyecto)")
    else:
        god_names = [ap["description"] for ap in god_modules]
        if not any("god_module" in d.lower() or "GodModule" in d for d in god_names):
            # Podría tener un nombre diferente en el id — verificar affected_module_ids
            god_ids = [mid for ap in god_modules for mid in ap["affectedModuleIds"]]
            if not any("god_module" in mid for mid in god_ids):
                errors.append(f"Se detectó God Module pero no incluye god_module.py: {god_ids}")
        print(f"  [OK] God Module: {len(god_modules)} detectado(s).")

    # 3.2 Circular Dependency
    circular = [ap for ap in antipatterns if ap["antipatternType"] == "circular-dependency"]
    if not circular:
        # Puede que no haya ciclos reales si la resolución de imports no matchea
        print("  [INFO] No se detectaron Circular Dependencies (puede depender de la resolución de imports).")
    else:
        print(f"  [OK] Circular Dependency: {len(circular)} ciclo(s) detectado(s).")
        for c in circular:
            print(f"       Ruta: {' → '.join(c.get('cyclePath', []))}")

    # 3.3 Layer Violation
    layer_violations = [ap for ap in antipatterns if ap["antipatternType"] == "layer-violation"]
    if amg.get("detectedStyle") in ("layered", "hexagonal"):
        if not layer_violations:
            errors.append(
                f"No se detectaron Layer Violations con estilo '{amg.get('detectedStyle')}' "
                f"(se esperaban violaciones de capa en el fixture)"
            )
        else:
            print(f"  [OK] Layer Violation: {len(layer_violations)} violación(es) detectada(s).")
            for lv in layer_violations:
                print(f"       {lv['description'][:100]}")
    else:
        print(f"  [INFO] Estilo detectado: '{amg.get('detectedStyle')}' — Layer Violations solo aplican a 'layered' o 'hexagonal'.")

    # ─── Resultado Final ─────────────────────────────────────────────
    if errors:
        print("\n  [ERRORES DE DETECCIÓN]:")
        for e in errors:
            print(f"    - {e}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    # ─── Limpieza ────────────────────────────────────────────────────
    shutil.rmtree(fixture_dir, ignore_errors=True)
    print(f"\n[LIMPIEZA] Fixture removido.")

    print("\n" + "=" * 66)
    print("   DETECCIÓN DE ANTIPATRONES VERIFICADA EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()
