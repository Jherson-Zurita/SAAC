"""
test_supplementary_diagrams.py — Verificador de los Diagramas Suplementarios
Adicionales (Package Diagram, Inheritance Tree, ER Diagram).

Valida que el pipeline completo de SAAC v2.0 genere, dentro de
`amg.c4Models.componentDiagrams`, las tres claves suplementarias añadidas en
`supplementary_diagrams.rs`:
  - "supplementary:package-diagram"
  - "supplementary:inheritance-tree"
  - "supplementary:er-diagram"

Genera un fixture sintético con:
  1. Subcarpetas anidadas bajo `services/` (billing/, shipping/) para
     validar que el Package Diagram agrupa por directorio COMPLETO y no
     solo por el penúltimo segmento del path (bug corregido en
     `extract_package_name`).
  2. Una clase base en un archivo y una clase derivada en OTRO archivo
     distinto, para validar que Inheritance Tree resuelve herencia
     CROSS-MÓDULO (a diferencia del Nivel 4 de C4, que es solo intra-módulo).
  3. Dos "entidades" en `models/` con una referencia cruzada por tipo de
     atributo, para validar la detección de relaciones del ER Diagram.
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
    """
    Genera un proyecto sintético con:
      fixture_dir/
        services/
          billing/
            invoice_service.py    <- importa shipping/tracking_service (cross-package)
          shipping/
            tracking_service.py
        domain/
          base_entity.py          <- clase base: BaseEntity
        models/
          user.py                 <- User(BaseEntity), importa order.py (cross-module inheritance)
          order.py                <- Order, con atributo user: User (relación ER)
    """
    os.makedirs(fixture_dir, exist_ok=True)

    # --- services/billing y services/shipping (anidamiento para Package Diagram) ---
    billing_dir = os.path.join(fixture_dir, "services", "billing")
    shipping_dir = os.path.join(fixture_dir, "services", "shipping")
    os.makedirs(billing_dir, exist_ok=True)
    os.makedirs(shipping_dir, exist_ok=True)

    with open(os.path.join(shipping_dir, "tracking_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "class TrackingService:\n"
            "    def track(self):\n"
            "        return 'tracking'\n"
        )
    with open(os.path.join(billing_dir, "invoice_service.py"), "w", encoding="utf-8") as f:
        f.write(
            "from services.shipping.tracking_service import TrackingService\n\n"
            "class InvoiceService:\n"
            "    def invoice(self):\n"
            "        return TrackingService().track()\n"
        )

    # --- domain/base_entity.py: clase base para herencia cross-módulo ---
    domain_dir = os.path.join(fixture_dir, "domain")
    os.makedirs(domain_dir, exist_ok=True)
    with open(os.path.join(domain_dir, "base_entity.py"), "w", encoding="utf-8") as f:
        f.write(
            "class BaseEntity:\n"
            "    def __init__(self, id):\n"
            "        self.id = id\n"
        )

    # --- models/user.py y models/order.py: entidades + herencia cross-módulo + referencia ER ---
    models_dir = os.path.join(fixture_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    # User hereda de BaseEntity (definida en OTRO módulo: domain/base_entity.py)
    with open(os.path.join(models_dir, "user.py"), "w", encoding="utf-8") as f:
        f.write(
            "from domain.base_entity import BaseEntity\n\n"
            "class User(BaseEntity):\n"
            "    def __init__(self, id, name):\n"
            "        super().__init__(id)\n"
            "        self.name = name\n"
        )

    # Order tiene un atributo tipado como User -> relación ER esperada Order -> User
    with open(os.path.join(models_dir, "order.py"), "w", encoding="utf-8") as f:
        f.write(
            "from models.user import User\n\n"
            "class Order:\n"
            "    def __init__(self, id, user: User):\n"
            "        self.id = id\n"
            "        self.user: User = user\n"
        )


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Diagramas Suplementarios")
    print("  (Package Diagram, Inheritance Tree, ER Diagram)")
    print("=" * 66)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_tauri_dir = os.path.join(os.path.dirname(base_dir), "src-tauri")
    if not os.path.isdir(src_tauri_dir):
        src_tauri_dir = os.path.join(base_dir, "..", "src-tauri")

    fixture_dir = os.path.join(base_dir, "fixtures", "mock_supplementary")

    # ─── Fase 1: Preparar fixture ────────────────────────────────────
    print("\n[FASE 1] Preparando fixture con paquetes anidados, herencia")
    print("         cross-módulo y entidades relacionadas...")
    shutil.rmtree(fixture_dir, ignore_errors=True)
    generate_supplementary_fixture(fixture_dir)
    print("  [OK] Fixture creado.")

    # ─── Fase 2: Ejecutar análisis ───────────────────────────────────
    print("\n[FASE 2] Ejecutando analyze_project...")
    analysis = run_analyze_project(fixture_dir, src_tauri_dir)

    amg = analysis.get("amg")
    if not amg:
        print("  [ERROR] No se generó el AMG en el resultado del análisis.")
        print(f"  Resultado: {json.dumps(analysis, indent=2)[:800]}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    component_diagrams = amg.get("c4Models", {}).get("componentDiagrams", {})
    print(f"  [OK] Análisis completado. Claves en componentDiagrams: {list(component_diagrams.keys())}")

    package_diagram = component_diagrams.get("supplementary:package-diagram")
    inheritance_tree = component_diagrams.get("supplementary:inheritance-tree")
    er_diagram = component_diagrams.get("supplementary:er-diagram")

    # ─── Debug ────────────────────────────────────────────────────────
    if package_diagram:
        print("\n[DEBUG] Package Diagram:")
        for n in package_diagram.get("nodes", []):
            print(f"  - Nodo: {n['id']} :: {n['description']}")
        for e in package_diagram.get("edges", []):
            print(f"  - Arista: {e['source']} -> {e['target']} ({e['label']})")

    if inheritance_tree:
        print("\n[DEBUG] Inheritance Tree:")
        for n in inheritance_tree.get("nodes", []):
            print(f"  - Nodo: {n['id']} ({n['elementType']})")
        for e in inheritance_tree.get("edges", []):
            print(f"  - Arista: {e['source']} -> {e['target']} ({e['label']})")

    if er_diagram:
        print("\n[DEBUG] ER Diagram:")
        for n in er_diagram.get("nodes", []):
            print(f"  - Nodo: {n['id']} :: {n['description']}")
        for e in er_diagram.get("edges", []):
            print(f"  - Arista: {e['source']} -> {e['target']} ({e['label']})")

    # ─── Fase 3: Validaciones ────────────────────────────────────────
    print("\n[FASE 3] Validando contenido de los diagramas suplementarios...")
    errors = []

    # 3.1 Presencia de las tres claves
    if package_diagram is None:
        errors.append("Falta la clave 'supplementary:package-diagram' en componentDiagrams")
    if inheritance_tree is None:
        errors.append("Falta la clave 'supplementary:inheritance-tree' en componentDiagrams")
    if er_diagram is None:
        errors.append("Falta la clave 'supplementary:er-diagram' en componentDiagrams")

    # 3.2 Package Diagram: services/billing y services/shipping deben ser
    # paquetes DISTINTOS pero ambos bajo el prefijo "services/" — valida el
    # fix de extract_package_name (unión de directorio completo, no solo
    # penúltimo segmento).
    if package_diagram:
        pkg_ids = [n["id"] for n in package_diagram.get("nodes", [])]
        has_billing = any("services/billing" in pid.replace("\\", "/") for pid in pkg_ids)
        has_shipping = any("services/shipping" in pid.replace("\\", "/") for pid in pkg_ids)
        if not (has_billing and has_shipping):
            errors.append(
                f"Package Diagram: se esperaban paquetes 'services/billing' y "
                f"'services/shipping' como nodos distintos, se encontró: {pkg_ids}"
            )
        else:
            print("  [OK] Package Diagram: 'services/billing' y 'services/shipping' "
                  "detectados como paquetes anidados distintos.")

        # Debe existir una arista entre esos dos paquetes (invoice_service
        # importa tracking_service, en paquetes distintos)
        pkg_edges = package_diagram.get("edges", [])
        has_cross_pkg_edge = any(
            "billing" in e["source"].replace("\\", "/") and "shipping" in e["target"].replace("\\", "/")
            for e in pkg_edges
        )
        if not has_cross_pkg_edge:
            errors.append(
                f"Package Diagram: se esperaba una arista de 'services/billing' -> "
                f"'services/shipping', aristas encontradas: {pkg_edges}"
            )
        else:
            print("  [OK] Package Diagram: arista cruzada billing -> shipping detectada.")

    # 3.3 Inheritance Tree: User debe extender BaseEntity, A PESAR de estar
    # en módulos distintos (models/user.py vs domain/base_entity.py).
    if inheritance_tree:
        inh_edges = inheritance_tree.get("edges", [])
        has_inheritance = any(
            "User" in e["source"] and "BaseEntity" in e["target"] and e["label"] == "extends"
            for e in inh_edges
        )
        if not has_inheritance:
            errors.append(
                f"Inheritance Tree: no se detectó 'User extends BaseEntity' "
                f"(cross-módulo). Aristas encontradas: {inh_edges}"
            )
        else:
            print("  [OK] Inheritance Tree: 'User extends BaseEntity' resuelto "
                  "correctamente entre módulos distintos.")

    # 3.4 ER Diagram: debe haber entidades User y Order, con una relación
    # Order -> User (Order tiene un atributo tipado User).
    if er_diagram:
        er_nodes = er_diagram.get("nodes", [])
        er_edges = er_diagram.get("edges", [])
        entity_labels = [n["label"] for n in er_nodes]

        if "User" not in entity_labels or "Order" not in entity_labels:
            errors.append(
                f"ER Diagram: se esperaban entidades 'User' y 'Order', "
                f"encontradas: {entity_labels}"
            )
        else:
            print(f"  [OK] ER Diagram: entidades detectadas: {entity_labels}")

        has_reference = any(
            "Order" in e["source"] and "User" in e["target"] and e["label"] == "references"
            for e in er_edges
        )
        if not has_reference:
            errors.append(
                f"ER Diagram: no se detectó la relación 'Order references User'. "
                f"Aristas encontradas: {er_edges}"
            )
        else:
            print("  [OK] ER Diagram: relación 'Order references User' detectada.")

    if errors:
        print("\n  [ERRORES]:")
        for e in errors:
            print(f"    - {e}")
        shutil.rmtree(fixture_dir, ignore_errors=True)
        sys.exit(1)

    # ─── Limpieza ────────────────────────────────────────────────────
    shutil.rmtree(fixture_dir, ignore_errors=True)
    print(f"\n[LIMPIEZA] Fixture removido.")

    print("\n" + "=" * 66)
    print("   DIAGRAMAS SUPLEMENTARIOS VERIFICADOS EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()