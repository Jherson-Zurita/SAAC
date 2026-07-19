pub mod commands;
pub mod engine;
pub mod workers;
pub mod ollama;

use crate::workers::node_worker::{NodeWorkerManager, WorkerConfig as NodeConfig};
use crate::workers::python_worker::{PythonWorkerManager, WorkerConfig as PythonConfig};
use crate::commands::analysis::CancellationRegistry;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Construye la aplicación Tauri (plugins, comandos registrados) SIN
/// inicializar los workers y SIN arrancar el event loop de la ventana.
///
/// IMPORTANTE: a diferencia de una versión anterior de esta función, `.setup()`
/// aquí NO llama a `tauri::async_runtime::block_on(...)` internamente. Hacerlo
/// anidado dentro de otro `block_on` externo (como el que usa el modo CLI de
/// testing en `main.rs`) produce una condición de carrera sobre el mismo
/// runtime de tokio: el `app.manage(...)` del `block_on` interno puede no
/// haber hecho commit todavía cuando el código externo ya está pidiendo
/// `state()`, resultando en el panic `state() called before manage()`.
///
/// La inicialización real de los workers vive ahora en `init_workers()`,
/// que el llamador debe `.await`ear explícitamente en su PROPIO (único)
/// `block_on`, después de `build_app()` y antes de usar `AppHandle::state()`.
pub fn build_app() -> tauri::App<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::analysis::analyze_project,
            commands::analysis::analyze_file,
            commands::analysis::analyze_files,
            commands::analysis::cancel_analysis,
            commands::project::open_project,
            commands::ai::ask_ai,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
}

/// Inicializa y registra (`app.manage(...)`) los workers reales de Node y
/// Python, más el `CancellationRegistry` de `analyze_project`.
///
/// Debe llamarse exactamente una vez, después de `build_app()` y ANTES de
/// cualquier llamada a `AppHandle::state::<NodeWorkerManager>()` (o los
/// otros dos tipos gestionados aquí) — de lo contrario esas llamadas a
/// `state()` entran en pánico. El llamador es responsable de `.await`earla
/// dentro de su propio runtime async (un solo `block_on`, sin anidar otro
/// dentro de `build_app`/`.setup()`).
pub async fn init_workers(app: &tauri::App<tauri::Wry>) {
    let handle_node = app.handle().clone();
    let handle_python = app.handle().clone();

    let node_config = NodeConfig::default();
    let node_manager = NodeWorkerManager::new(handle_node, node_config)
        .await
        .expect("Failed to initialize Node worker manager");
    app.manage(node_manager);

    let python_config = PythonConfig::default();
    // Si la validación de entorno de Python falla, el constructor de PythonWorkerManager
    // propagará el error informando que no hay una versión compatible.
    let python_manager = PythonWorkerManager::new(handle_python, python_config)
        .await
        .expect("Failed to initialize Python worker manager");
    app.manage(python_manager);

    // Registro de cancelación para analyze_project. Se inicializa vacío
    // (sin análisis en curso). No depende de `.await` en sí, pero se deja
    // aquí junto a los demás `.manage()` para que exista un único punto de
    // inicialización de estado gestionado, en vez de repartirlo entre
    // `build_app()` y `init_workers()`.
    app.manage(CancellationRegistry::default());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = build_app();

    // Único `block_on` de este binario en modo GUI: inicializa los workers
    // antes de que arranque el event loop de la ventana.
    tauri::async_runtime::block_on(init_workers(&app));

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            // Apagado ordenado de ambos subprocesos en paralelo al cerrar la app
            let node_manager_opt = app_handle.try_state::<NodeWorkerManager>();
            let python_manager_opt = app_handle.try_state::<PythonWorkerManager>();

            tauri::async_runtime::block_on(async {
                let node_shutdown = async {
                    if let Some(m) = node_manager_opt {
                        m.shutdown().await;
                    }
                };
                let python_shutdown = async {
                    if let Some(m) = python_manager_opt {
                        m.shutdown().await;
                    }
                };
                tokio::join!(node_shutdown, python_shutdown);
            });
        }
    });
}