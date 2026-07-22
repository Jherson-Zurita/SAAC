"""
test_ai_integration.py — Verificador de la Integración de IA Local (Ollama & OpenAI Compatible).

Valida que el backend de SAAC v2.0:
1. Compile correctamente con el cliente de IA (reqwest + Ollama/OpenAI-Compatible/Mock).
2. Siga generando el AMG correctamente vía `analyze_project` (sin regresiones).
3. Ejecute `AiClient::ask` REALMENTE en modo Mock (vía el modo CLI
   `--ask-ai-mock`), confirmando construcción de prompt, marca explícita
   de fallback (`isMockFallback`), y contenido de respuesta no vacío —
   sin depender de que haya un servidor LLM real corriendo en la máquina.
"""

import os
import sys
import subprocess
import json
import shutil


def run_command(cmd: list[str], cwd: str, timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def main():
    print("=" * 66)
    print("  SAAC v2.0 - Verificador de Integración de IA Local (Ollama/Mock)")
    print("=" * 66)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_tauri_dir = os.path.join(os.path.dirname(base_dir), "src-tauri")
    if not os.path.isdir(src_tauri_dir):
        src_tauri_dir = os.path.join(base_dir, "..", "src-tauri")

    # ─── Fase 1: Validar compilación de Rust ────────────────────────
    print("\n[FASE 1] Verificando compilación de Rust...")
    res = run_command(["cargo", "check"], cwd=src_tauri_dir)
    if res.returncode != 0:
        print(f"  [ERROR] cargo check falló:\n{res.stderr}")
        sys.exit(1)
    print("  [OK] Compilación de Rust exitosa con cliente de IA (reqwest + Ollama/Mock).")

    # ─── Fase 2: Validar fallback simulado y construcción de prompts ─
    print("\n[FASE 2] Validando respuesta de IA en modo simulado / offline...")
    print("  NOTA: si esta es la primera compilación tras agregar reqwest a")
    print("  Cargo.toml, 'cargo run' puede tardar varios minutos (compila y")
    print("  linkea TLS nativo + hyper por primera vez, sin caché de target/).")
    print("  Corridas siguientes serán mucho más rápidas.")

    # Creamos un fixture rápido para tener un AMG con métricas reales
    fixture_dir = os.path.join(base_dir, "fixtures", "mock_ai_project")
    os.makedirs(fixture_dir, exist_ok=True)
    with open(os.path.join(fixture_dir, "main.py"), "w", encoding="utf-8") as f:
        f.write("def main():\n    print('hello AI')\n")

    res = run_command(
        ["cargo", "run", "--quiet", "--", "--analyze-project-json", fixture_dir],
        cwd=src_tauri_dir,
        # Timeout ampliado respecto al de la Fase 1: a diferencia de `cargo
        # check`, `cargo run` compila y LINKEA el binario completo. La
        # primera vez que se compila tras agregar una dependencia nueva y
        # pesada (reqwest, que arrastra hyper + TLS nativo) puede tardar
        # bastante más de 120s sin caché de `target/` — no es un cuelgue
        # real del programa, es tiempo de compilación. Corridas siguientes
        # son mucho más rápidas gracias al caché incremental de cargo.
        timeout=420,
    )
    shutil.rmtree(fixture_dir, ignore_errors=True)

    if res.returncode != 0:
        print(f"  [ERROR] analyze_project falló:\n{res.stderr}")
        sys.exit(1)

    lines = [l for l in res.stdout.splitlines() if l.strip()]
    analysis = json.loads(lines[-1])
    amg = analysis.get("amg", {})

    print("  [OK] AMG generado para contexto de IA:")
    print(f"       Mantenibilidad Promedio: {amg.get('metrics', {}).get('maintainabilityIndexAvg', 0):.1f}")
    print(f"       Estilo Detectado: {amg.get('detectedStyle')}")

    # ─── Fase 3: Invocar AiClient::ask REAL en modo Mock ─────────────
    print("\n[FASE 3] Invocando AiClient::ask en modo Mock (--ask-ai-mock)...")
    print("  NOTA: valida el flujo REAL de ask_ai — construcción de prompt,")
    print("  respuesta estructurada y marca de fallback — sin depender de un")
    print("  servidor LLM externo. Las Fases 1-2 solo confirmaban que el")
    print("  crate compila y que analyze_project no se rompió; esta fase")
    print("  ejercita el código de ai_client.rs de verdad.")

    test_prompt = "What antipatterns does my project have?"
    res = run_command(
        ["cargo", "run", "--quiet", "--", "--ask-ai-mock", test_prompt],
        cwd=src_tauri_dir,
        timeout=120,  # Ya compilado en Fase 2, debería ser rápido.
    )

    if res.returncode != 0:
        print(f"  [ERROR] --ask-ai-mock falló (code {res.returncode}):\n{res.stderr}")
        sys.exit(1)

    lines = [l for l in res.stdout.splitlines() if l.strip()]
    if not lines:
        print(f"  [ERROR] --ask-ai-mock no produjo salida.\nstderr:\n{res.stderr}")
        sys.exit(1)

    try:
        ai_response = json.loads(lines[-1])
    except json.JSONDecodeError as e:
        print(f"  [ERROR] No se pudo parsear la salida JSON: {e}\nSalida cruda:\n{res.stdout}")
        sys.exit(1)

    errors = []

    # 3.1 Debe estar marcada explícitamente como fallback/mock — crítico
    # para que el frontend pueda distinguir una respuesta real de un LLM
    # de una simulada, y mostrarlo claramente al usuario.
    if ai_response.get("isMockFallback") is not True:
        errors.append(
            f"Se esperaba isMockFallback=true en modo Mock, se obtuvo: "
            f"{ai_response.get('isMockFallback')}"
        )

    # 3.2 El proveedor usado debe ser 'mock'
    if ai_response.get("providerUsed") != "mock":
        errors.append(f"Se esperaba providerUsed='mock', se obtuvo: {ai_response.get('providerUsed')}")

    # 3.3 El contenido no debe estar vacío
    content = ai_response.get("content", "")
    if not content or not content.strip():
        errors.append("El campo 'content' de la respuesta está vacío")

    # 3.4 El prompt original del usuario debe reflejarse en el prompt
    # generado (generatedPrompt), confirmando que build_prompt() incorporó
    # la consulta real y no solo el contexto estático.
    generated_prompt = ai_response.get("generatedPrompt", "")
    if test_prompt not in generated_prompt:
        errors.append(
            f"El prompt original ('{test_prompt}') no aparece en 'generatedPrompt'. "
            f"generatedPrompt: {generated_prompt[:200]}"
        )

    if errors:
        print("  [ERRORES]:")
        for e in errors:
            print(f"    - {e}")
        sys.exit(1)

    print(f"  [OK] isMockFallback=true, providerUsed='mock'")
    print(f"  [OK] Contenido de respuesta no vacío ({len(content)} caracteres)")
    print(f"  [OK] Prompt del usuario reflejado correctamente en generatedPrompt")

    print("\n" + "=" * 66)
    print("   INTEGRACIÓN DE IA LOCAL Y FALLBACK VERIFICADOS EXITOSAMENTE!")
    print("=" * 66)


if __name__ == "__main__":
    main()