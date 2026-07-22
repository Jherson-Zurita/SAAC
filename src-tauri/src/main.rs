// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Modo CLI de testing: `tauri-app --scan-json <ruta>` ejecuta el escaneo real
    // de `scan_project_directory` y lo imprime como JSON a stdout, sin arrancar
    // el runtime de Tauri/WebView2. Esto permite que los tests de integración en
    // Python (test_analyze_project.py) ejerciten la lógica REAL de Rust —
    // incluyendo el motor completo de `.gitignore` de la crate `ignore` — en vez
    // de reimplementarla en Python. Debe evaluarse ANTES de tauri_app_lib::run(),
    // que es lo que dispara la inicialización de WebView2 y falla en `cargo test`
    // sobre Windows.
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--scan-json") {
        let path = match args.get(pos + 1) {
            Some(p) => p,
            None => {
                eprintln!("Error: --scan-json requiere una ruta como argumento.");
                std::process::exit(2);
            }
        };

        let (file_paths, skipped_files, node_files_count, python_files_count) =
            tauri_app_lib::commands::analysis::scan_project_directory(path);

        let output = serde_json::json!({
            "filePaths": file_paths,
            "skippedFiles": skipped_files,
            "nodeFilesCount": node_files_count,
            "pythonFilesCount": python_files_count,
        });

        // Salida SOLO el JSON en stdout, para que el test pueda hacer json.loads()
        // directo sin tener que filtrar logs de tracing u otro ruido.
        println!("{}", serde_json::to_string(&output).expect("Fallo al serializar resultado de escaneo"));
        std::process::exit(0);
    }

    // Modo CLI de testing: `tauri-app --analyze-project-json <ruta> [--cancel-after-ms <n>]`
    // ejercita el flujo REAL y completo de `analyze_project` (workers Node/Python
    // reales, chunking, progreso, y opcionalmente cancelación vía
    // `cancel_analysis`), sin arrancar el event loop de la ventana. Reutiliza
    // `build_app()` — la misma inicialización que usa `run()` en producción — así
    // que no hay riesgo de que este camino de testing diverja del real.
    //
    // Si se pasa `--cancel-after-ms <n>`, se lanza una tarea de tokio que espera
    // `n` milisegundos y llama a `cancel_analysis`, simulando al usuario pulsando
    // "cancelar" a mitad del análisis. El resultado impreso incluye `cancelled`
    // y `outcomes` parciales para que el test de Python pueda verificar que la
    // cancelación efectivamente cortó el trabajo antes de completar todo.
    if let Some(pos) = args.iter().position(|a| a == "--analyze-project-json") {
        let path = match args.get(pos + 1) {
            Some(p) => p.clone(),
            None => {
                eprintln!("Error: --analyze-project-json requiere una ruta como argumento.");
                std::process::exit(2);
            }
        };

        let cancel_after_ms: Option<u64> = args
            .iter()
            .position(|a| a == "--cancel-after-ms")
            .and_then(|p| args.get(p + 1))
            .and_then(|v| v.parse().ok());

        let app = tauri_app_lib::build_app();
        let handle = app.handle().clone();

        tauri::async_runtime::block_on(async move {
            use tauri::Manager;

            // Inicializar los workers ANTES de pedir su State — mismo
            // requisito que en `run()`, ahora satisfecho explícitamente en
            // vez de depender de un `block_on` anidado dentro de `.setup()`
            // (que era la causa del panic "state() called before manage()").
            tauri_app_lib::init_workers(&app).await;

            let node_manager = handle.state::<tauri_app_lib::workers::node_worker::NodeWorkerManager>();
            let python_manager = handle.state::<tauri_app_lib::workers::python_worker::PythonWorkerManager>();
            let cancellation = handle.state::<tauri_app_lib::commands::analysis::CancellationRegistry>();

            if let Some(delay_ms) = cancel_after_ms {
                let handle_for_cancel = handle.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    // Reutiliza el comando `cancel_analysis` tal cual — el mismo
                    // código que invocaría el frontend vía IPC — en vez de
                    // duplicar su lógica de acceso al CancellationRegistry aquí.
                    let _ = tauri_app_lib::commands::analysis::cancel_analysis(
                        handle_for_cancel.state(),
                    );
                });
            }

            let result = tauri_app_lib::commands::analysis::analyze_project(
                node_manager,
                python_manager,
                cancellation,
                handle.clone(),
                path,
            )
            .await;

            match result {
                Ok(analysis) => {
                    println!(
                        "{}",
                        serde_json::to_string(&analysis)
                            .expect("Fallo al serializar ProjectAnalysisResult")
                    );
                    std::process::exit(0);
                }
                Err(e) => {
                    eprintln!("Error en analyze_project: {e}");
                    std::process::exit(1);
                }
            }
        });
    }

    // Modo CLI de testing: `tauri-app --ask-ai-mock <prompt>` ejercita
    // `AiClient::ask` en modo `Mock` de forma aislada — sin arrancar Tauri,
    // sin workers, sin red — para validar que el fallback/respuesta
    // simulada y la construcción de prompts (`build_prompt`) funcionan
    // correctamente. A diferencia de `--analyze-project-json`, este modo
    // NO necesita `build_app()`/`init_workers()` porque `AiClient::ask` no
    // depende de `State`/`AppHandle` en absoluto — es una función asociada
    // normal, así que un `block_on` directo alcanza.
    if let Some(pos) = args.iter().position(|a| a == "--ask-ai-mock") {
        let prompt = match args.get(pos + 1) {
            Some(p) => p.clone(),
            None => {
                eprintln!("Error: --ask-ai-mock requiere un prompt como argumento.");
                std::process::exit(2);
            }
        };

        use tauri_app_lib::engine::ai_client::{AiClient, AiConfig, AiContextType, AiProvider};

        let config = AiConfig {
            provider: AiProvider::Mock,
            ..AiConfig::default()
        };

        let result = tauri::async_runtime::block_on(AiClient::ask(
            &prompt,
            &AiContextType::FullAmg,
            None, // Sin AMG cargado — ejercita la rama "CONTEXTO GENERAL" de build_prompt.
            &config,
        ));

        match result {
            Ok(response) => {
                println!(
                    "{}",
                    serde_json::to_string(&response)
                        .expect("Fallo al serializar AiResponse")
                );
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("Error en AiClient::ask: {e}");
                std::process::exit(1);
            }
        }
    }

    tauri_app_lib::run()
}