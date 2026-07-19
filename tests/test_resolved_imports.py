"""
test_resolved_imports.py — Verificador de la resolución de imports absolutos.

Valida que el Agregador en Rust resuelva correctamente los imports específicos:
1. Java packages (ej: `import com.example.service.UserService` -> `src/main/java/com/example/service/UserService.java`)
2. Go modules (ej: `import "mymodule/pkg/service"` -> todos los archivos en `pkg/service/`)
3. Rust use (ej: `use crate::service::UserService` o `use my_crate::service::UserService`)
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
        print(f"  [ERROR] No se pudo parsear el JSON de salida: {e}\nSalida cruda:\n{result.stdout}")
        sys.exit(1)


def generate_resolved_fixture(fixture_dir: str):
    """Genera un proyecto mock con estructuras válidas para Java, Go y Rust."""
    os.makedirs(fixture_dir, exist_ok=True)

    # 1. Configuración de Java
    java_dir = os.path.join(fixture_dir, "java-app")
    os.makedirs(os.path.join(java_dir, "src/main/java/com/example/service"), exist_ok=True)
    with open(os.path.join(java_dir, "pom.xml"), "w", encoding="utf-8") as f:
        f.write("<project><build><sourceDirectory>src/main/java</sourceDirectory></build></project>\n")
    
    # com.example.App importa com.example.service.UserService
    with open(os.path.join(java_dir, "src/main/java/com/example/App.java"), "w", encoding="utf-8") as f:
        f.write("package com.example;\nimport com.example.service.UserService;\npublic class App {}\n")
    with open(os.path.join(java_dir, "src/main/java/com/example/service/UserService.java"), "w", encoding="utf-8") as f:
        f.write("package com.example.service;\npublic class UserService {}\n")

    # 2. Configuración de Go
    go_dir = os.path.join(fixture_dir, "go-app")
    os.makedirs(os.path.join(go_dir, "pkg/service"), exist_ok=True)
    with open(os.path.join(go_dir, "go.mod"), "w", encoding="utf-8") as f:
        f.write("module mymodule\n")
    
    # main.go importa "mymodule/pkg/service"
    with open(os.path.join(go_dir, "main.go"), "w", encoding="utf-8") as f:
        f.write("package main\nimport \"mymodule/pkg/service\"\nfunc main() {}\n")
    with open(os.path.join(go_dir, "pkg/service/service.go"), "w", encoding="utf-8") as f:
        f.write("package service\nfunc Run() {}\n")

    # 3. Configuración de Rust
    rust_dir = os.path.join(fixture_dir, "rust-app")
    os.makedirs(os.path.join(rust_dir, "src/service"), exist_ok=True)
    with open(os.path.join(rust_dir, "Cargo.toml"), "w", encoding="utf-8") as f:
        f.write("[package]\nname = \"my_crate\"\n")
    
    # main.rs importa crate::service::UserService
    with open(os.path.join(rust_dir, "src/main.rs"), "w", encoding="utf-8") as f:
        f.write("use crate::service::UserService;\nfn main() {}\n")
    # use my_crate::helper::helper_func
    os.makedirs(os.path.join(rust_dir, "src/helper"), exist_ok=True)
    with open(os.path.join(rust_dir, "src/helper/mod.rs"), "w", encoding="utf-8") as f:
        f.write("pub fn helper_func() {}\n")
    with open(os.path.join(rust_dir, "src/service/mod.rs"), "w", encoding="utf-8") as f:
        # service/mod.rs importa use my_crate::helper::helper_func
        f.write("use my_crate::helper::helper_func;\npub struct UserService {}\n")


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Resolucion de Imports Absolutos  ")
    print("=" * 66)

    base_dir = os.path.abspath(os.path.dirname(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    src_tauri_dir = os.path.join(project_root, "src-tauri")
    fixture_dir = os.path.join(base_dir, "fixtures", "mock_resolved_project")

    # 1. Preparar el fixture
    print("\n[FASE 1] Preparando fixture de lenguajes...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    generate_resolved_fixture(fixture_dir)
    print("  [OK] Estructuras de proyecto Java, Go y Rust creadas.")

    # 2. Ejecutar el análisis
    print("\n[FASE 2] Ejecutando analyze_project...")
    analysis = run_analyze_project(fixture_dir, src_tauri_dir)
    amg = analysis.get("amg")
    
    if not amg:
        print("  [ERROR] No se genero el AMG en el resultado del analisis.")
        print(f"  Resultado de analisis: {json.dumps(analysis, indent=2)}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    print("  [OK] Analisis completado. Analizando dependencias del AMG...")

    # 3. Validar resolución de dependencias
    dependencies = amg.get("dependencies", [])
    errors = []

    # Helper para buscar dependencias en el AMG
    def has_dependency(source_suffix: str, target_suffix: str) -> bool:
        for dep in dependencies:
            src = dep["source"].replace("\\", "/")
            tgt = dep["target"].replace("\\", "/")
            if src.endswith(source_suffix) and tgt.endswith(target_suffix):
                return True
        return False

    print("\n[DEBUG] modulos en el AMG:")
    for m in amg.get("modules", []):
        print(f"  - ID: {m['id']} (Language: {m['language']})")
        print(f"    Imports: {m.get('imports', [])}")
    print("\n[DEBUG] dependencias en el AMG:")
    for dep in dependencies:
        print(f"  - {dep['source']} -> {dep['target']} ({dep['kind']})")

    # 3.1 Verificación Java
    print("\n[VERIFICACION] Validando resolucion en Java...")
    # com/example/App.java -> com/example/service/UserService.java
    if has_dependency("com/example/App", "com/example/service/UserService"):
        print("  [OK] Java: 'com.example.service.UserService' resuelto correctamente.")
    else:
        errors.append("Java: No se pudo resolver 'com.example.service.UserService' desde App.java")

    # 3.2 Verificación Go
    print("\n[VERIFICACION] Validando resolucion en Go...")
    # main.go -> pkg/service/service.go
    if has_dependency("go-app/main", "go-app/pkg/service/service"):
        print("  [OK] Go: 'mymodule/pkg/service' resuelto correctamente a service.go.")
    else:
        errors.append("Go: No se pudo resolver 'mymodule/pkg/service' desde main.go")

    # 3.3 Verificación Rust
    print("\n[VERIFICACION] Validando resolucion en Rust...")
    # main.rs -> src/service/mod.rs (via crate::service::UserService)
    if has_dependency("rust-app/src/main", "rust-app/src/service/mod"):
        print("  [OK] Rust: 'crate::service::UserService' resuelto correctamente a service/mod.rs.")
    else:
        errors.append("Rust: No se pudo resolver 'crate::service::UserService' desde main.rs")

    # service/mod.rs -> src/helper/mod.rs (via my_crate::helper::helper_func)
    if has_dependency("rust-app/src/service/mod", "rust-app/src/helper/mod"):
        print("  [OK] Rust: 'my_crate::helper::helper_func' resuelto correctamente a helper/mod.rs.")
    else:
        errors.append("Rust: No se pudo resolver 'my_crate::helper::helper_func' desde service/mod.rs")

    if errors:
        print("\n  [ERRORES DE RESOLUCION]:")
        for e in errors:
            print(f"    - {e}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    # 4. Limpieza
    print("\n[LIMPIEZA] Removiendo archivos temporales...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    print("  [OK] Fixtures limpiados.")

    print("\n" + "=" * 66)
    print("   TODAS LAS RESOLUCIONES DE IMPORTS VERIFICADAS EXITOSAMENTE!")
    print("=" * 66)

if __name__ == "__main__":
    main()
