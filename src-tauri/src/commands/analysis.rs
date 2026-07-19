use crate::workers::node_worker::NodeWorkerManager;
use crate::workers::python_worker::PythonWorkerManager;
use crate::workers::types::{
    FileAnalysisOutcome, AnalysisFileStatus, ProjectAnalysisResult, SkippedFile, ProjectProgressEvent
};
use tauri::{State, Emitter};
use ignore::WalkBuilder;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::path::Path;
use sha2::{Sha256, Digest};
use std::io::Read;
use crate::engine::cache::CacheManager;
use crate::engine::aggregator::Aggregator;
use crate::engine::project_detector::ProjectDetector;
use crate::engine::java_source_roots::detect_java_source_roots;
use crate::engine::go_module_roots::detect_go_modules;
use crate::engine::rust_crate_roots::detect_rust_crates;
use crate::engine::amg::{ArchitectureModelGraph, WorkerAnalysisResult, SnapshotType};

const BATCH_CHUNK_SIZE: usize = 50;
const MAX_FILE_SIZE_BYTES: u64 = 1_048_576; // 1 MB

/// Registro gestionado por Tauri (vía `app.manage(...)`) que guarda el flag de
/// cancelación del análisis de proyecto actualmente en curso, si lo hay.
///
/// Se admite un único análisis de proyecto concurrente por diseño (igual que
/// hoy `analyze_project` no soporta llamadas paralelas de sí mismo); si se
/// necesitara soporte multi-análisis en el futuro, este campo pasaría a un
/// `HashMap<AnalysisId, Arc<AtomicBool>>` identificado por un id devuelto al
/// frontend al iniciar el análisis.
#[derive(Default)]
pub struct CancellationRegistry {
    current: Mutex<Option<Arc<AtomicBool>>>,
}

impl CancellationRegistry {
    /// Registra un nuevo flag de cancelación como el análisis "activo",
    /// reemplazando cualquier flag anterior (que, si existía, ya debería
    /// haber finalizado — `analyze_project` limpia su propio flag al salir).
    fn register(&self, flag: Arc<AtomicBool>) {
        let mut guard = self.current.lock().expect("CancellationRegistry mutex envenenado");
        *guard = Some(flag);
    }

    /// Limpia el flag activo. Debe llamarse siempre al finalizar
    /// `analyze_project`, tanto en éxito como en cancelación, para que un
    /// `cancel_analysis` posterior no actúe sobre un análisis ya terminado.
    fn clear(&self) {
        let mut guard = self.current.lock().expect("CancellationRegistry mutex envenenado");
        *guard = None;
    }

    /// Solicita la cancelación del análisis activo, si lo hay.
    /// Devuelve `true` si había un análisis en curso al que señalizar.
    fn request_cancel(&self) -> bool {
        let guard = self.current.lock().expect("CancellationRegistry mutex envenenado");
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }
}

struct ProgressReporter<'a> {
    app_handle: &'a tauri::AppHandle,
    total_files: usize,
    completed_files: Arc<std::sync::atomic::AtomicUsize>,
    node_files: usize,
    python_files: usize,
    skipped_files: usize,
}

impl<'a> ProgressReporter<'a> {
    fn report(&self, current_file: Option<String>) {
        let completed = self.completed_files.load(std::sync::atomic::Ordering::SeqCst);
        let event = ProjectProgressEvent {
            phase: if completed >= self.total_files - self.skipped_files {
                "done".to_string()
            } else {
                "analyzing".to_string()
            },
            total_files: self.total_files,
            completed_files: completed,
            node_files: self.node_files,
            python_files: self.python_files,
            skipped_files: self.skipped_files,
            current_file,
        };
        let _ = self.app_handle.emit("project://progress", event);
    }
}

/// Determina si un archivo debe ser analizado por el worker de Node.js (TS/JS).
fn is_node_file(file_path: &str) -> bool {
    let path = std::path::Path::new(file_path);
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        let ext_lower = ext.to_lowercase();
        matches!(ext_lower.as_str(), "ts" | "tsx" | "js" | "jsx")
    } else {
        false
    }
}

/// Determina si un archivo debe ser analizado por el worker de Python (Python/Java/Go/etc.).
fn is_python_file(file_path: &str) -> bool {
    let path = std::path::Path::new(file_path);
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        let ext_lower = ext.to_lowercase();
        matches!(
            ext_lower.as_str(),
            "py" | "pyi" | "java" | "kt" | "kts" | "cs" | "swift" | "go" | "rs"
        )
    } else {
        false
    }
}

/// Helper para escanear y clasificar el directorio del proyecto sin dependencias de runtime GUI.
///
/// Público (no solo `pub(crate)`) para que `main.rs` pueda invocarlo directamente
/// en modo CLI (`--scan-json`), permitiendo que los tests de integración en Python
/// ejerciten la lógica REAL de escaneo (incluyendo el motor completo de `.gitignore`
/// de la crate `ignore`) sin necesidad de arrancar el runtime de Tauri/WebView2,
/// que falla en `cargo test` sobre Windows (STATUS_ENTRYPOINT_NOT_FOUND).
pub fn scan_project_directory(path: &str) -> (Vec<String>, Vec<SkippedFile>, usize, usize) {
    let mut file_paths = Vec::new();
    let mut skipped_files = Vec::new();
    let mut node_files_count = 0;
    let mut python_files_count = 0;

    let walker = WalkBuilder::new(path).build();

    for result in walker {
        match result {
            Ok(entry) => {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let p = entry.path();
                    let path_str = p.to_string_lossy().replace('\\', "/");
                    
                    // Exclusiones explícitas
                    if path_str.contains("/node_modules/")
                        || path_str.contains("/target/")
                        || path_str.contains("/.venv/")
                        || path_str.contains("/.git/")
                    {
                        continue;
                    }

                    let is_node = is_node_file(&path_str);
                    let is_python = is_python_file(&path_str);

                    if is_node || is_python {
                        let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        if file_size > MAX_FILE_SIZE_BYTES {
                            skipped_files.push(SkippedFile {
                                file_path: p.to_string_lossy().into_owned(),
                                reason: "file_too_large".to_string(),
                            });
                        } else {
                            if is_node {
                                node_files_count += 1;
                            } else {
                                python_files_count += 1;
                            }
                            file_paths.push(p.to_string_lossy().into_owned());
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Error escaneando entrada del directorio: {}", e);
            }
        }
    }

    (file_paths, skipped_files, node_files_count, python_files_count)
}

// Helper interno para analizar un conjunto de archivos separándolos por worker con chunking.
// Devuelve (outcomes_completados, fue_cancelado). Si `cancel_flag` se activa entre
// chunks, los loops de Node y Python cortan ANTES de enviar el siguiente chunk —
// el chunk que ya estaba en vuelo al momento de la señal se deja completar (no se
// aborta a mitad de un batch en curso), y los archivos de chunks no enviados
// simplemente no aparecen en el resultado (no se generan outcomes "fantasma").
async fn analyze_files_internal(
    node_manager: &NodeWorkerManager,
    python_manager: &PythonWorkerManager,
    file_paths: Vec<String>,
    reporter: Option<&ProgressReporter<'_>>,
    cancel_flag: Option<&Arc<AtomicBool>>,
) -> (Vec<FileAnalysisOutcome>, bool) {
    let total = file_paths.len();
    if total == 0 {
        return (Vec::new(), false);
    }

    let mut node_paths = Vec::new();
    let mut python_paths = Vec::new();
    let mut unsupported_outcomes = Vec::new();

    for file_path in file_paths.iter() {
        if is_node_file(file_path) {
            node_paths.push(file_path.clone());
        } else if is_python_file(file_path) {
            python_paths.push(file_path.clone());
        } else {
            unsupported_outcomes.push(FileAnalysisOutcome {
                file_path: file_path.clone(),
                status: AnalysisFileStatus::ParseError,
                result: None,
                error_message: Some("Lenguaje no soportado por SAAC".to_string()),
            });
        }
    }

    let is_cancelled = || cancel_flag.map(|f| f.load(Ordering::SeqCst)).unwrap_or(false);

    // Procesar chunks de Node en un bucle secuencial, verificando cancelación
    // antes de cada chunk (no a mitad de uno ya en vuelo).
    let node_fut = async {
        let mut results = Vec::new();
        let mut cancelled = false;
        for chunk in node_paths.chunks(BATCH_CHUNK_SIZE) {
            if is_cancelled() {
                cancelled = true;
                break;
            }
            let chunk_vec = chunk.to_vec();
            let chunk_len = chunk_vec.len();
            let mut chunk_outcomes = node_manager.send_analyze_request(chunk_vec).await;

            if let Some(rep) = reporter {
                let last_file = chunk_outcomes.last().map(|o| o.file_path.clone());
                rep.completed_files.fetch_add(chunk_len, std::sync::atomic::Ordering::SeqCst);
                rep.report(last_file);
            }
            results.append(&mut chunk_outcomes);
        }
        (results, cancelled)
    };

    // Procesar chunks de Python en un bucle secuencial, misma lógica de cancelación.
    let python_fut = async {
        let mut results = Vec::new();
        let mut cancelled = false;
        for chunk in python_paths.chunks(BATCH_CHUNK_SIZE) {
            if is_cancelled() {
                cancelled = true;
                break;
            }
            let chunk_vec = chunk.to_vec();
            let chunk_len = chunk_vec.len();
            let mut chunk_outcomes = python_manager.send_analyze_request(chunk_vec).await;

            if let Some(rep) = reporter {
                let last_file = chunk_outcomes.last().map(|o| o.file_path.clone());
                rep.completed_files.fetch_add(chunk_len, std::sync::atomic::Ordering::SeqCst);
                rep.report(last_file);
            }
            results.append(&mut chunk_outcomes);
        }
        (results, cancelled)
    };

    // Ejecutar ambos loops de chunks concurrentemente (máximo 2 núcleos activos)
    let ((node_results, node_cancelled), (python_results, python_cancelled)) =
        tokio::join!(node_fut, python_fut);

    let cancelled = node_cancelled || python_cancelled;

    // Los archivos "no soportados" se clasifican antes de cualquier trabajo async,
    // así que siempre se incluyen completos — cancelar no afecta esta clasificación
    // instantánea, solo el trabajo real de los workers.
    let mut outcomes = unsupported_outcomes;
    outcomes.extend(node_results);
    outcomes.extend(python_results);

    (outcomes, cancelled)
}

// Helper para calcular el hash SHA256 de un archivo de manera eficiente
fn calculate_file_hash(path: &str) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

// Comandos de análisis
#[tauri::command]
pub async fn analyze_project(
    node_manager: State<'_, NodeWorkerManager>,
    python_manager: State<'_, PythonWorkerManager>,
    cancellation: State<'_, CancellationRegistry>,
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<ProjectAnalysisResult, String> {
    let start_time = std::time::Instant::now();
    let (file_paths, skipped_files, node_files_count, python_files_count) = scan_project_directory(&path);

    let total_files = file_paths.len() + skipped_files.len();

    // Fase 1: Emitir progreso de escaneo inicial
    let progress_event = ProjectProgressEvent {
        phase: "scanning".to_string(),
        total_files,
        completed_files: 0,
        node_files: node_files_count,
        python_files: python_files_count,
        skipped_files: skipped_files.len(),
        current_file: None,
    };
    let _ = app_handle.emit("project://progress", progress_event);

    if file_paths.is_empty() {
        let duration_ms = start_time.elapsed().as_millis() as u64;
        let final_event = ProjectProgressEvent {
            phase: "done".to_string(),
            total_files,
            completed_files: 0,
            node_files: 0,
            python_files: 0,
            skipped_files: skipped_files.len(),
            current_file: None,
        };
        let _ = app_handle.emit("project://progress", final_event);

        return Ok(ProjectAnalysisResult {
            total_files,
            successful: 0,
            failed: 0,
            skipped: skipped_files.len(),
            outcomes: Vec::new(),
            skipped_files,
            duration_ms,
            cancelled: false,
            amg: None,
        });
    }

    // Inicializar el gestor de caché
    let cache = match CacheManager::open(&path) {
        Ok(c) => Some(c),
        Err(e) => {
            tracing::warn!("No se pudo abrir la base de datos de caché en {}: {}", path, e);
            None
        }
    };

    // Separar archivos en caché de los que necesitan analizarse
    let mut files_to_analyze = Vec::new();
    let mut cached_outcomes = Vec::new();
    let mut file_hashes = std::collections::HashMap::new();

    for file_path in file_paths {
        if let Ok(hash) = calculate_file_hash(&file_path) {
            file_hashes.insert(file_path.clone(), hash.clone());
            
            let mut found_in_cache = false;
            if let Some(ref cache_mgr) = cache {
                if let Some(cached_result) = cache_mgr.get_file_analysis(&file_path, &hash) {
                    cached_outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::Success,
                        result: serde_json::to_value(&cached_result).ok(),
                        error_message: None,
                    });
                    found_in_cache = true;
                }
            }
            if !found_in_cache {
                files_to_analyze.push(file_path);
            }
        } else {
            files_to_analyze.push(file_path);
        }
    }

    // Registrar el flag de cancelación de este análisis ANTES de empezar a
    // procesar, para que una llamada a `cancel_analysis` en cualquier momento
    // posterior (incluso durante el primer chunk) surta efecto.
    let cancel_flag = Arc::new(AtomicBool::new(false));
    cancellation.register(cancel_flag.clone());

    // El progreso inicial refleja los archivos recuperados de la caché
    let completed_files = Arc::new(std::sync::atomic::AtomicUsize::new(cached_outcomes.len()));
    let reporter = ProgressReporter {
        app_handle: &app_handle,
        total_files,
        completed_files: completed_files.clone(),
        node_files: node_files_count,
        python_files: python_files_count,
        skipped_files: skipped_files.len(),
    };

    // Fase 2: Analizar archivos con chunking, reporte de progreso y chequeo de cancelación
    let (mut outcomes, was_cancelled) = if !files_to_analyze.is_empty() {
        let (new_outcomes, cancelled) = analyze_files_internal(
            &node_manager,
            &python_manager,
            files_to_analyze,
            Some(&reporter),
            Some(&cancel_flag),
        )
        .await;

        // Guardar los nuevos resultados exitosos en la caché
        if let Some(ref cache_mgr) = cache {
            for outcome in &new_outcomes {
                if outcome.status == AnalysisFileStatus::Success {
                    if let Some(result_val) = &outcome.result {
                        if let Ok(worker_res) = serde_json::from_value::<WorkerAnalysisResult>(result_val.clone()) {
                            if let Some(hash) = file_hashes.get(&outcome.file_path) {
                                let _ = cache_mgr.set_file_analysis(&outcome.file_path, hash, &worker_res);
                            }
                        }
                    }
                }
            }
        }
        (new_outcomes, cancelled)
    } else {
        (Vec::new(), false)
    };

    // Agregar resultados recuperados de la caché
    outcomes.extend(cached_outcomes);

    // Liberar el flag del registro SIEMPRE al salir (éxito o cancelación), para
    // que `cancel_analysis` no actúe por error sobre un análisis futuro que
    // reutilice el mismo slot del registro.
    cancellation.clear();

    let duration_ms = start_time.elapsed().as_millis() as u64;

    let mut successful = 0;
    let mut failed = 0;

    for outcome in &outcomes {
        if outcome.status == AnalysisFileStatus::Success {
            successful += 1;
        } else {
            failed += 1;
        }
    }

    // Fase 3: Emitir progreso finalizado (o cancelado)
    let final_event = ProjectProgressEvent {
        phase: if was_cancelled { "cancelled".to_string() } else { "done".to_string() },
        total_files,
        completed_files: completed_files.load(Ordering::SeqCst),
        node_files: node_files_count,
        python_files: python_files_count,
        skipped_files: skipped_files.len(),
        current_file: None,
    };
    let _ = app_handle.emit("project://progress", final_event);

    // Intentar realizar la agregación si no hubo una cancelación total sin outcomes
    let (worker_results, _failures) = Aggregator::parse_worker_results(&outcomes);
    let amg = if !worker_results.is_empty() {
        // Detección de raíces de fuentes Java (pom.xml / build.gradle* /
        // convención estándar) — necesaria para resolver con precisión
        // imports de paquetes Java contra los module_id del proyecto. Se
        // calcula una sola vez por análisis (no por archivo); para
        // proyectos sin ningún módulo Java, el resultado simplemente no
        // se usa dentro del aggregator (su índice específico de Java queda
        // vacío), así que no hay costo funcional en calcularlo siempre.
        let java_source_roots = detect_java_source_roots(Path::new(&path));
        let go_modules = detect_go_modules(Path::new(&path));
        let rust_crates = detect_rust_crates(Path::new(&path));

        let aggregated = Aggregator::aggregate(worker_results, &java_source_roots, &go_modules, &rust_crates);
        let project_detection = ProjectDetector::detect(&path);
        
        let amg_id = format!("{:x}-{:x}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos(), std::process::id());
        let analysis_run_id = amg_id.clone();
        let project_name = Path::new(&path)
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Unknown Project".to_string());
        
        let parent_amg_id = cache.as_ref().and_then(|c| c.get_latest_amg().map(|a| a.amg_id));

        let compiled_amg = ArchitectureModelGraph {
            amg_id,
            analysis_run_id,
            project_id: format!("{:x}", sha2::Sha256::digest(path.as_bytes())),
            project_name,
            detected_type: project_detection.detected_type,
            detected_style: aggregated.detected_style,
            style_confidence: aggregated.style_confidence,
            analyzed_at: chrono::Utc::now().to_rfc3339(),
            parent_amg_id,
            snapshot_type: SnapshotType::Full,
            modules: aggregated.modules,
            dependencies: aggregated.dependencies,
            containers: Vec::new(),
            external_systems: Vec::new(),
            actors: Vec::new(),
            external_calls: Vec::new(),
            antipatterns: Vec::new(),
            metrics: aggregated.metrics,
            c4_models: crate::engine::amg::C4Models::default(),
        };

        if let Some(ref cache_mgr) = cache {
            let _ = cache_mgr.set_latest_amg(&compiled_amg);
        }

        Some(compiled_amg)
    } else {
        None
    };

    Ok(ProjectAnalysisResult {
        total_files,
        successful,
        failed,
        skipped: skipped_files.len(),
        outcomes,
        skipped_files,
        duration_ms,
        cancelled: was_cancelled,
        amg,
    })
}

/// Solicita la cancelación del `analyze_project` actualmente en curso, si lo hay.
///
/// La cancelación es cooperativa y toma efecto ENTRE chunks (no aborta un chunk
/// de hasta `BATCH_CHUNK_SIZE` archivos ya en vuelo hacia un worker). El
/// resultado final de `analyze_project` incluirá `cancelled: true` y solo los
/// outcomes de los archivos que alcanzaron a procesarse.
///
/// Devuelve `true` si había un análisis en curso al que señalizar, `false` si
/// no había ninguno activo (ej. ya había terminado, o nunca se inició).
#[tauri::command]
pub fn cancel_analysis(cancellation: State<'_, CancellationRegistry>) -> Result<bool, String> {
    Ok(cancellation.request_cancel())
}

#[tauri::command]
pub async fn analyze_file(
    node_manager: State<'_, NodeWorkerManager>,
    python_manager: State<'_, PythonWorkerManager>,
    file_path: String,
    language: String,
    file_hash: String,
) -> Result<FileAnalysisOutcome, String> {
    if is_node_file(&file_path) {
        let outcome = node_manager.send_parse_request(file_path, language, file_hash).await;
        Ok(outcome)
    } else if is_python_file(&file_path) {
        let outcome = python_manager.send_parse_request(file_path, language, file_hash).await;
        Ok(outcome)
    } else {
        Ok(FileAnalysisOutcome {
            file_path,
            status: AnalysisFileStatus::ParseError,
            result: None,
            error_message: Some("Lenguaje no soportado por SAAC".to_string()),
        })
    }
}

#[tauri::command]
pub async fn analyze_files(
    node_manager: State<'_, NodeWorkerManager>,
    python_manager: State<'_, PythonWorkerManager>,
    file_paths: Vec<String>,
) -> Result<Vec<FileAnalysisOutcome>, String> {
    let (outcomes, _cancelled) =
        analyze_files_internal(&node_manager, &python_manager, file_paths, None, None).await;
    Ok(outcomes)
}