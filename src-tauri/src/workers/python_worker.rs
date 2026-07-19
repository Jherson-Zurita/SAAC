//! PythonWorkerManager — Orquestación del worker Python (parser multilenguaje AST) desde Rust.
//!
//! Responsabilidades:
//!   - Validar la versión de Python (>= 3.10) para evitar stubs vacíos de Windows Store.
//!   - Spawnear y mantener vivo el proceso worker (main.py).
//!   - Enviar WorkerRequest por stdin, correlacionar respuestas por `request_id`.
//!   - Emitir progreso parcial a la UI de Tauri mientras corre un análisis batch.
//!   - Recuperarse de timeouts, crashes del proceso, y JSON malformado sin tumbar
//!     el pipeline completo de análisis.
//!
//! Referencia: §Manejo de Fallos del plan de integración Rust/Python.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

// ─────────────────────────────────────────────────────────────────────────
// Tipos de protocolo — reutilizados desde `types.rs`, que es la única
// fuente de verdad compartida entre NodeWorkerManager y PythonWorkerManager.
//
// Antes este bloque redefinía WorkerCommand/ParsePayload/.../FileAnalysisOutcome
// desde cero (copiados como "espejo" de node_worker.rs antes de que existiera
// types.rs). Esto producía DOS structs distintos con el mismo nombre
// `FileAnalysisOutcome` — uno en `types.rs` y otro en `python_worker.rs` — que
// Rust trata como tipos incompatibles aunque tengan idéntica forma. Ese fue
// el origen exacto del error E0308 en `analysis.rs` ("expected
// types::FileAnalysisOutcome, found python_worker::FileAnalysisOutcome"):
// analysis.rs importa el tipo de `types.rs`, pero este archivo devolvía el
// suyo propio. La corrección es que ambos workers usen el mismo tipo,
// nunca que se hagan coincidir estructuralmente dos definiciones separadas.
// ─────────────────────────────────────────────────────────────────────────

use crate::workers::types::{
    AnalysisFileStatus, AnalyzePayload, FileAnalysisOutcome, ParsePayload, WorkerCommand,
    WorkerProgressEvent, WorkerRequest, WorkerResponse, WorkerStatus,
};

/// Errores internos del manager.
#[derive(Debug, thiserror::Error)]
pub enum WorkerError {
    #[error("El worker no respondió dentro del tiempo límite")]
    Timeout,
    #[error("El proceso worker terminó inesperadamente")]
    ProcessCrashed,
    #[error("El worker reportó un error de parseo: {0}")]
    ParseError(String),
    #[error("El worker no está disponible tras agotar los reintentos de reinicio")]
    Unavailable,
    #[error("Error de I/O al comunicarse con el worker: {0}")]
    Io(#[from] std::io::Error),
    #[error("Error de serialización: {0}")]
    Serde(#[from] serde_json::Error),
}

// ─────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct WorkerConfig {
    /// Ruta al script del worker (main.py).
    pub script_path: String,
    /// Timeout para un `parse` de archivo individual.
    pub parse_timeout: Duration,
    /// Timeout mínimo para un batch `analyze`, independientemente del tamaño.
    pub analyze_min_timeout: Duration,
    /// Segundos adicionales de timeout por cada archivo en un batch `analyze`.
    pub analyze_timeout_per_file: Duration,
    /// Número máximo de reintentos de respawn tras un crash del proceso.
    pub max_respawn_attempts: u32,
    /// Backoff entre reintentos de respawn.
    pub respawn_backoff: Vec<Duration>,
    /// Timeout de espera de confirmación al enviar `shutdown`.
    pub shutdown_timeout: Duration,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            script_path: default_python_script_path(),
            parse_timeout: Duration::from_secs(30),
            analyze_min_timeout: Duration::from_secs(60),
            analyze_timeout_per_file: Duration::from_secs(2),
            max_respawn_attempts: 3,
            respawn_backoff: vec![
                Duration::from_secs(1),
                Duration::from_secs(3),
                Duration::from_secs(5),
            ],
            shutdown_timeout: Duration::from_secs(2),
        }
    }
}

/// Resuelve la ruta absoluta a `workers/python/main.py` anclada a la raíz
/// del proyecto SAAC, en vez de relativa al CWD del proceso en tiempo de
/// ejecución.
///
/// Mismo problema y mismo fix que `default_node_script_path` en
/// `node_worker.rs` — ver el docstring de esa función para la explicación
/// completa. Resumen: `cargo run`/`cargo check` DEBEN ejecutarse con CWD en
/// `SAAC/src-tauri/` (donde vive `Cargo.toml`), y el binario resultante
/// hereda ese CWD al arrancar. Con `script_path` relativo
/// (`"workers/python/main.py"`), la ruta resuelta terminaba siendo
/// `SAAC/src-tauri/workers/python/main.py` — inexistente — y el worker de
/// Python crasheaba en el primer request (`status: "worker_crashed"` para
/// TODOS los archivos, incluyendo Java/Go/Rust, que también se rutean a
/// este worker vía `is_python_file`).
///
/// `CARGO_MANIFEST_DIR` se resuelve en TIEMPO DE COMPILACIÓN (vía `env!`)
/// a la carpeta de este crate (`SAAC/src-tauri/`); subiendo un nivel se
/// llega a la raíz real del proyecto (`SAAC/`), sin depender del CWD del
/// proceso en ningún momento de la ejecución.
///
/// Misma limitación conocida que en Node: correcto para desarrollo, no
/// para una build empaquetada de producción (ver docstring de
/// `default_node_script_path` en `node_worker.rs`).
fn default_python_script_path() -> String {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let project_root = std::path::Path::new(manifest_dir)
        .parent()
        .expect("CARGO_MANIFEST_DIR debería tener un padre (la raíz del proyecto SAAC)");
    project_root
        .join("workers")
        .join("python")
        .join("main.py")
        .to_string_lossy()
        .into_owned()
}

// ─────────────────────────────────────────────────────────────────────────
// PythonWorkerManager
// ─────────────────────────────────────────────────────────────────────────

type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<WorkerResponse>>>>;

/// Administra el ciclo de vida completo del subproceso Python.
pub struct PythonWorkerManager {
    config: WorkerConfig,
    app_handle: AppHandle,
    /// Comando de ejecutable validado de Python (ej: "python" o "python3").
    python_cmd: String,
    /// Handle al proceso hijo actual.
    process: Arc<Mutex<Option<Child>>>,
    /// Canal de escritura hacia stdin del proceso actual.
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    /// Requests en vuelo.
    pending: PendingMap,
    /// Contador de reintentos de respawn consumidos.
    respawn_attempts: Arc<Mutex<u32>>,
}

impl PythonWorkerManager {
    /// Crea el manager, valida la versión de Python y spawnea el proceso.
    pub async fn new(app_handle: AppHandle, config: WorkerConfig) -> Result<Self> {
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let stdin_slot = Arc::new(Mutex::new(None));
        let process = Arc::new(Mutex::new(None));
        let respawn_attempts = Arc::new(Mutex::new(0u32));

        // Validación inicial de comandos
        let python_cmd = Self::validate_environment().await?;

        let manager = Self {
            config,
            app_handle,
            python_cmd,
            process,
            stdin: stdin_slot,
            pending,
            respawn_attempts,
        };

        manager.spawn_process().await?;
        Ok(manager)
    }

    /// Enumera TODOS los intérpretes de Python encontrados en el PATH (no
    /// solo el primero que resolvería `Command::new("python")`), en el
    /// mismo orden que usaría el shell/`where.exe`. Necesario porque en un
    /// sistema con varias instalaciones de Python (ej. una de MSYS2/UCRT64
    /// sin las dependencias del proyecto, y otra donde sí se corrió `pip
    /// install -r requirements.txt`), la PRIMERA del PATH gana la carrera
    /// aunque no sea la correcta — y antes de este fix, `validate_environment`
    /// solo probaba esa primera.
    fn find_python_candidates() -> Vec<std::path::PathBuf> {
        let mut candidates = Vec::new();
        let mut seen = std::collections::HashSet::new();

        let names: &[&str] = if cfg!(windows) {
            &["python.exe", "python3.exe"]
        } else {
            &["python3", "python"]
        };

        if let Some(path_var) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_var) {
                for name in names {
                    let candidate = dir.join(name);
                    if candidate.is_file() {
                        let key = candidate.to_string_lossy().to_lowercase();
                        if seen.insert(key) {
                            candidates.push(candidate);
                        }
                    }
                }
            }
        }

        candidates
    }

    /// Valida el/los intérprete(s) de Python del PATH probando CADA
    /// candidato encontrado (no solo el primero) hasta encontrar uno que
    /// cumpla version >= 3.10 Y tenga las dependencias del worker
    /// instaladas (`check_python_candidate`). Retorna el path completo del
    /// primero que pase ambos chequeos.
    async fn validate_environment() -> Result<String> {
        let candidates = Self::find_python_candidates();

        if candidates.is_empty() {
            // La enumeración de PATH no encontró nada (PATH no legible, o
            // nombres de ejecutable no estándar) — último recurso: probar
            // los nombres pelados, delegando la resolución al SO, igual que
            // se haca antes de este fix.
            return Self::validate_bare_commands().await;
        }

        let mut failures: Vec<String> = Vec::new();
        for candidate in &candidates {
            match Self::check_python_candidate(candidate).await {
                Ok(cmd) => {
                    tracing::info!(python = %cmd, "Intérprete de Python validado (versión + dependencias)");
                    return Ok(cmd);
                }
                Err(reason) => {
                    failures.push(format!("  - {}: {}", candidate.display(), reason));
                }
            }
        }

        Err(anyhow!(
            "Se encontraron {} instalación(es) de Python en el PATH, pero ninguna \
             cumple los requisitos (versión >= 3.10 Y dependencias del worker \
             instaladas). Detalle por candidato:\n{}\n\n\
             Si ya instalaste las dependencias en la versión correcta, revisá \
             que esa instalación esté antes en el PATH que las demás.\n\
             Para instalar las dependencias en un intérprete específico:\n\
             <ruta_al_python.exe> -m pip install -r workers/python/requirements.txt",
            candidates.len(),
            failures.join("\n")
        ))
    }

    /// Último recurso si la enumeración de PATH no encontró nada: prueba los
    /// nombres de comando pelados "python"/"python3", delegando la
    /// resolución al loader del SO — comportamiento previo a este fix.
    async fn validate_bare_commands() -> Result<String> {
        for cmd_name in ["python", "python3"] {
            match Self::check_python_candidate(std::path::Path::new(cmd_name)).await {
                Ok(cmd) => return Ok(cmd),
                Err(e) => tracing::info!("'{cmd_name}' no pasó la validación: {e}"),
            }
        }
        Err(anyhow!(
            "No se pudo encontrar una instalación válida de Python 3.10+ con las \
             dependencias del worker instaladas.\n\
             Asegurate de que Python 3.10+ esté en el PATH y que sus dependencias \
             estén instaladas: python -m pip install -r workers/python/requirements.txt"
        ))
    }

    /// Verifica que un candidato de Python cumpla AMBOS requisitos: versión
    /// >= 3.10 Y capacidad de importar `tree_sitter_language_pack` y
    /// `networkx` (las dependencias reales del worker, ver
    /// `workers/python/requirements.txt`).
    ///
    /// Antes solo se validaba la versión. En un sistema con varias
    /// instalaciones de Python en el PATH, eso deja pasar un intérprete que
    /// tiene la versión correcta pero NO las dependencias — el síntoma
    /// observado en la práctica fue `status: "worker_crashed"` para el
    /// 100% de los archivos de CUALQUIER lenguaje en un mismo batch: el
    /// intérprete equivocado pasaba `--version`, pero moría con
    /// `ModuleNotFoundError` en el primer `import` de `parsers/__init__.py`
    /// —ANTES de leer una sola línea de stdin—, matando el proceso para
    /// TODO el batch en curso, no solo para el archivo que se estaba
    /// procesando en ese momento.
    async fn check_python_candidate(cmd_path: &std::path::Path) -> Result<String, String> {
        let cmd_str = cmd_path.to_string_lossy().into_owned();

        let version_output = Command::new(&cmd_str)
            .arg("--version")
            .output()
            .await
            .map_err(|e| format!("no se pudo ejecutar: {e}"))?;

        if !version_output.status.success() {
            return Err("el comando --version retornó código de salida no exitoso".to_string());
        }

        let out_str = String::from_utf8_lossy(&version_output.stdout);
        let err_str = String::from_utf8_lossy(&version_output.stderr);
        let version_line = if out_str.is_empty() { &err_str } else { &out_str };

        let version_ok = version_line
            .trim()
            .strip_prefix("Python ")
            .and_then(|v_str| {
                let parts: Vec<&str> = v_str.trim().split('.').collect();
                if parts.len() < 2 {
                    return None;
                }
                let major: u32 = parts[0].parse().ok()?;
                let minor: u32 = parts[1].parse().ok()?;
                Some(major == 3 && minor >= 10)
            })
            .unwrap_or(false);

        if !version_ok {
            return Err(format!("versión no soportada o salida malformada: {}", version_line.trim()));
        }

        // Segundo chequeo, el que faltaba: ¿puede este intérprete importar
        // las dependencias reales del worker? No alcanza con la versión.
        let import_output = Command::new(&cmd_str)
            .args(["-c", "import tree_sitter_language_pack, networkx"])
            .output()
            .await
            .map_err(|e| format!("no se pudo ejecutar el chequeo de dependencias: {e}"))?;

        if !import_output.status.success() {
            let stderr = String::from_utf8_lossy(&import_output.stderr);
            return Err(format!(
                "versión OK pero faltan dependencias del worker (tree_sitter_language_pack / networkx): {}",
                stderr.trim()
            ));
        }

        Ok(cmd_str)
    }

    /// Spawnea el proceso Python y arranca los loops de comunicación.
    async fn spawn_process(&self) -> Result<()> {
        let mut child = Command::new(&self.python_cmd)
            .arg(&self.config.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .context("Error al spawnear el proceso worker Python")?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stdin del proceso worker Python"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stdout del proceso worker Python"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stderr del proceso worker Python"))?;

        // Guardar las referencias
        {
            let mut s_slot = self.stdin.lock().await;
            *s_slot = Some(stdin);
        }
        let process_ref = Arc::clone(&self.process);
        {
            let mut p_slot = process_ref.lock().await;
            *p_slot = Some(child);
        }

        // Loop de lectura de stdout
        let pending_for_stdout = Arc::clone(&self.pending);
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if line.trim().is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<WorkerResponse>(&line) {
                            Ok(response) => {
                                if response.status == WorkerStatus::Partial {
                                    // Los progresos parciales de batch se manejan en send_analyze_request,
                                    // el loop principal solo correlaciona resultados finales (Success/Error).
                                    continue;
                                }

                                let mut map = pending_for_stdout.lock().await;
                                if let Some(sender) = map.remove(&response.request_id) {
                                    let _ = sender.send(response);
                                }
                            }
                            Err(parse_err) => {
                                tracing::error!(
                                    error = %parse_err,
                                    raw_line = %line,
                                    "Línea de stdout del worker Python no es JSON válido"
                                );
                            }
                        }
                    }
                    Ok(None) => {
                        tracing::warn!("El worker Python cerró stdout inesperadamente");
                        let mut map = pending_for_stdout.lock().await;
                        for (_, sender) in map.drain() {
                            let _ = sender.send(WorkerResponse {
                                request_id: String::new(),
                                status: WorkerStatus::Error,
                                data: None,
                                error: Some("process_crashed".to_string()),
                                progress: None,
                            });
                        }
                        break;
                    }
                    Err(io_err) => {
                        tracing::error!(error = %io_err, "Error de I/O leyendo stdout del worker Python");
                        break;
                    }
                }
            }
        });

        // Loop de lectura de stderr
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "python_worker", "{line}");
            }
        });

        // Monitor de finalización: usa try_wait() en un loop de polling en
        // vez de wait() bloqueante. La versión anterior llamaba a
        // `child.wait().await` MIENTRAS sostenía el lock de `process`
        // (`p_lock`), lo cual bloquea ese Mutex por toda la vida del
        // proceso — cualquier llamada futura a shutdown()/force_kill() que
        // necesite tomar ese mismo lock quedaría esperando indefinidamente.
        // Este es el mismo problema que se corrigió en NodeWorkerManager;
        // se aplica aquí la misma solución para mantener paridad entre
        // ambos workers.
        let process_for_monitor = Arc::clone(&self.process);
        let pending_for_monitor = Arc::clone(&self.pending);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(300)).await;

                let mut slot = process_for_monitor.lock().await;
                let still_alive = match slot.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(None) => true,
                        Ok(Some(status)) => {
                            if status.success() {
                                tracing::info!("El proceso worker Python terminó normalmente");
                            } else {
                                tracing::warn!(exit_code = ?status.code(), "El worker Python terminó con error");
                            }
                            false
                        }
                        Err(err) => {
                            tracing::error!(error = %err, "Error consultando estado del worker Python");
                            false
                        }
                    },
                    // El slot ya fue vaciado por shutdown()/force_kill() o
                    // por un respawn concurrente: este monitor "viejo" debe
                    // terminar sin tocar nada más.
                    None => false,
                };

                if !still_alive {
                    if slot.is_some() {
                        *slot = None;
                        drop(slot);

                        let mut map = pending_for_monitor.lock().await;
                        for (_, sender) in map.drain() {
                            let _ = sender.send(WorkerResponse {
                                request_id: String::new(),
                                status: WorkerStatus::Error,
                                data: None,
                                error: Some("process_crashed".to_string()),
                                progress: None,
                            });
                        }
                    }
                    break;
                }
            }
        });

        Ok(())
    }

    /// Envía un request de parseo para un archivo individual.
    pub async fn send_parse_request(
        &self,
        file_path: String,
        language: String,
        file_hash: String,
    ) -> FileAnalysisOutcome {
        let request_id = uuid_v4();
        let payload = ParsePayload {
            file_path: file_path.clone(),
            language: Some(language),
            file_hash: Some(file_hash),
        };

        let request = WorkerRequest {
            request_id: request_id.clone(),
            command: WorkerCommand::Parse,
            payload: match serde_json::to_value(&payload) {
                Ok(v) => v,
                Err(e) => {
                    return FileAnalysisOutcome {
                        file_path,
                        status: AnalysisFileStatus::ParseError,
                        result: None,
                        error_message: Some(format!("Error serializando payload: {e}")),
                    }
                }
            },
        };

        match self.send_and_await(request, self.config.parse_timeout).await {
            Ok(response) => Self::response_to_outcome(file_path, response),
            Err(WorkerError::Timeout) => {
                self.cleanup_pending(&request_id).await;
                tracing::warn!(request_id = %request_id, file_path = %file_path, "Timeout esperando respuesta del worker Python");
                FileAnalysisOutcome {
                    file_path,
                    status: AnalysisFileStatus::Timeout,
                    result: None,
                    error_message: Some("El worker de Python no respondió a tiempo".into()),
                }
            }
            Err(WorkerError::ProcessCrashed) => {
                self.handle_crash_and_maybe_respawn().await;
                FileAnalysisOutcome {
                    file_path,
                    status: AnalysisFileStatus::WorkerCrashed,
                    result: None,
                    error_message: Some("El proceso worker de Python crasheó".into()),
                }
            }
            Err(WorkerError::Unavailable) => FileAnalysisOutcome {
                file_path,
                status: AnalysisFileStatus::WorkerUnavailable,
                result: None,
                error_message: Some("El worker de Python no está disponible".into()),
            },
            Err(other) => FileAnalysisOutcome {
                file_path,
                status: AnalysisFileStatus::ParseError,
                result: None,
                error_message: Some(other.to_string()),
            },
        }
    }

    /// Envía un request de análisis para un lote de archivos.
    pub async fn send_analyze_request(
        &self,
        file_paths: Vec<String>,
    ) -> Vec<FileAnalysisOutcome> {
        let total = file_paths.len();
        let mut outcomes = Vec::with_capacity(total);

        let batch_timeout = self.config.analyze_min_timeout
            + self.config.analyze_timeout_per_file * (total as u32);

        let request_id = uuid_v4();
        let payload = AnalyzePayload {
            files: file_paths
                .iter()
                .map(|file_path| ParsePayload {
                    file_path: file_path.clone(),
                    language: None,
                    file_hash: None,
                })
                .collect(),
        };
        let request = WorkerRequest {
            request_id: request_id.clone(),
            command: WorkerCommand::Analyze,
            payload: serde_json::to_value(&payload).unwrap_or(Value::Null),
        };

        match self.send_and_await(request, batch_timeout).await {
            Ok(response) => {
                match Self::batch_response_to_outcomes(&file_paths, response) {
                    Ok(results) => {
                        for (i, outcome) in results.iter().enumerate() {
                            self.emit_progress(&request_id, Some(&outcome.file_path), i + 1, total);
                        }
                        outcomes = results;
                    }
                    Err(e) => {
                        for file_path in &file_paths {
                            outcomes.push(FileAnalysisOutcome {
                                file_path: file_path.clone(),
                                status: AnalysisFileStatus::ParseError,
                                result: None,
                                error_message: Some(e.to_string()),
                            });
                        }
                    }
                }
            }
            Err(WorkerError::Timeout) => {
                self.cleanup_pending(&request_id).await;
                tracing::warn!(request_id = %request_id, "Timeout esperando el batch de Python");
                for file_path in &file_paths {
                    outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::Timeout,
                        result: None,
                        error_message: Some("El worker de Python no respondió a tiempo".into()),
                    });
                }
            }
            Err(WorkerError::ProcessCrashed) => {
                self.handle_crash_and_maybe_respawn().await;
                for file_path in &file_paths {
                    outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::WorkerCrashed,
                        result: None,
                        error_message: Some("El proceso worker de Python crasheó".into()),
                    });
                }
            }
            Err(other) => {
                for file_path in &file_paths {
                    outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::ParseError,
                        result: None,
                        error_message: Some(other.to_string()),
                    });
                }
            }
        }

        outcomes
    }

    /// Envía comando shutdown de forma limpia.
    pub async fn shutdown(&self) {
        let request_id = uuid_v4();
        let request = WorkerRequest {
            request_id: request_id.clone(),
            command: WorkerCommand::Shutdown,
            payload: Value::Null,
        };

        let result = self
            .send_and_await(request, self.config.shutdown_timeout)
            .await;

        match result {
            Ok(_) => {
                tracing::info!("Worker Python confirmó shutdown ordenado");
                let mut slot = self.process.lock().await;
                *slot = None;
            }
            Err(_) => {
                tracing::warn!(
                    "El worker Python no confirmó shutdown a tiempo; forzando terminación del proceso"
                );
                self.force_kill().await;
            }
        }
    }

    /// Termina el proceso worker de Python de forma forzosa. Fallback de
    /// `shutdown()` cuando no hay confirmación a tiempo; ver el mismo método
    /// en NodeWorkerManager para la justificación completa.
    async fn force_kill(&self) {
        let mut slot = self.process.lock().await;
        if let Some(child) = slot.as_mut() {
            if let Err(e) = child.kill().await {
                tracing::error!(error = %e, "Error al forzar la terminación del worker Python");
            } else {
                tracing::info!("Proceso worker Python terminado de forma forzosa");
            }
        }
        *slot = None;
    }

    // ── Internos ──

    async fn send_and_await(
        &self,
        request: WorkerRequest,
        request_timeout: Duration,
    ) -> Result<WorkerResponse, WorkerError> {
        let (tx, rx) = oneshot::channel::<WorkerResponse>();

        {
            let mut map = self.pending.lock().await;
            map.insert(request.request_id.clone(), tx);
        }

        let mut line = serde_json::to_string(&request)?;
        line.push('\n');

        {
            let mut slot = self.stdin.lock().await;
            match slot.as_mut() {
                Some(stdin) => {
                    stdin.write_all(line.as_bytes()).await?;
                    stdin.flush().await?;
                }
                None => {
                    self.cleanup_pending(&request.request_id).await;
                    return Err(WorkerError::Unavailable);
                }
            }
        }

        match timeout(request_timeout, rx).await {
            Ok(Ok(response)) => {
                if response.status == WorkerStatus::Error {
                    let msg = response
                        .error
                        .clone()
                        .unwrap_or_else(|| "Error desconocido en Python".into());
                    if msg == "process_crashed" {
                        return Err(WorkerError::ProcessCrashed);
                    }
                    return Err(WorkerError::ParseError(msg));
                }
                Ok(response)
            }
            Ok(Err(_recv_error)) => Err(WorkerError::ProcessCrashed),
            Err(_elapsed) => Err(WorkerError::Timeout),
        }
    }

    async fn cleanup_pending(&self, request_id: &str) {
        let mut map = self.pending.lock().await;
        map.remove(request_id);
    }

    async fn handle_crash_and_maybe_respawn(&self) {
        {
            let mut slot = self.stdin.lock().await;
            *slot = None;
        }
        {
            let mut slot = self.process.lock().await;
            *slot = None;
        }

        let mut attempts = self.respawn_attempts.lock().await;

        if *attempts >= self.config.max_respawn_attempts {
            tracing::error!(
                "Se agotaron los {} reintentos de reinicio de Python",
                self.config.max_respawn_attempts
            );
            self.emit_worker_unavailable();
            return;
        }

        let backoff = self
            .config
            .respawn_backoff
            .get(*attempts as usize)
            .copied()
            .unwrap_or_else(|| *self.config.respawn_backoff.last().unwrap());

        *attempts += 1;
        let attempt_number = *attempts;
        drop(attempts);

        tracing::info!(
            intento = attempt_number,
            espera_segundos = backoff.as_secs(),
            "Reintentando iniciar el worker Python"
        );

        tokio::time::sleep(backoff).await;

        if let Err(e) = self.spawn_process().await {
            tracing::error!(error = %e, "Falló el reintento de reinicio de Python");
        } else {
            let mut attempts = self.respawn_attempts.lock().await;
            *attempts = 0;
        }
    }

    fn emit_progress(&self, request_id: &str, file_path: Option<&str>, completed: usize, total: usize) {
        let event = WorkerProgressEvent {
            request_id: request_id.to_string(),
            file_path: file_path.map(|s| s.to_string()),
            completed,
            total,
        };
        if let Err(e) = self.app_handle.emit("worker://progress", &event) {
            tracing::warn!(error = %e, "No se pudo emitir progreso de Python");
        }
    }

    fn emit_worker_unavailable(&self) {
        if let Err(e) = self
            .app_handle
            .emit("worker://unavailable", &serde_json::json!({ "worker": "python" }))
        {
            tracing::warn!(error = %e, "No se pudo emitir worker no disponible");
        }
    }

    fn response_to_outcome(file_path: String, response: WorkerResponse) -> FileAnalysisOutcome {
        FileAnalysisOutcome {
            file_path,
            status: AnalysisFileStatus::Success,
            result: response.data,
            error_message: None,
        }
    }

    fn batch_response_to_outcomes(
        file_paths: &[String],
        response: WorkerResponse,
    ) -> Result<Vec<FileAnalysisOutcome>, WorkerError> {
        let data = response
            .data
            .ok_or_else(|| WorkerError::ParseError("Respuesta de batch Python sin data".into()))?;

        let items = data
            .get("results")
            .and_then(|v| v.as_array())
            .ok_or_else(|| WorkerError::ParseError("data.results de batch Python no es un arreglo".into()))?;

        let mut outcomes = Vec::with_capacity(file_paths.len());
        for item in items {
            let file_path = item
                .get("filePath")
                .and_then(|v| v.as_str())
                .unwrap_or("desconocido")
                .to_string();

            let status_str = item.get("status").and_then(|v| v.as_str()).unwrap_or("error");
            let status = if status_str == "success" {
                AnalysisFileStatus::Success
            } else {
                AnalysisFileStatus::ParseError
            };

            outcomes.push(FileAnalysisOutcome {
                file_path,
                status,
                result: item.get("result").cloned(),
                error_message: item.get("errorMessage").and_then(|v| v.as_str()).map(|s| s.to_string()),
            });
        }

        Ok(outcomes)
    }
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}-{:x}", nanos, std::process::id())
}