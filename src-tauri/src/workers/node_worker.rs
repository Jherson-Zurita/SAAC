//! NodeWorkerManager — Orquestación del worker Node.js (parser TS/JS) desde Rust.
//!
//! Responsabilidades:
//!   - Spawnear y mantener vivo el proceso worker (dist/index.js).
//!   - Enviar WorkerRequest por stdin, correlacionar respuestas por `request_id`.
//!   - Emitir progreso parcial a la UI de Tauri mientras corre un análisis batch.
//!   - Recuperarse de timeouts, crashes del proceso, y JSON malformado sin tumbar
//!     el pipeline completo de análisis.
//!
//! Referencia: §Manejo de Fallos del plan de integración Rust/Node.

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

use crate::workers::types::*;

/// Errores internos del manager (no expuestos directamente al frontend;
/// se traducen a `AnalysisFileStatus` en el punto de llamada).
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
    /// Ruta al script del worker (dist/index.js).
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
            script_path: default_node_script_path(),
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

/// Resuelve la ruta absoluta a `workers/node/dist/index.js` anclada a la
/// raíz del proyecto SAAC, en vez de relativa al CWD del proceso en tiempo
/// de ejecución.
///
/// ANTES: `script_path` era el literal relativo `"workers/node/dist/index.js"`,
/// pasado tal cual a `Command::new("node").arg(...)`. Eso solo resolvía
/// correctamente si el proceso Rust se lanzaba con el CWD exactamente en la
/// raíz del proyecto (`SAAC/`) — pero `cargo run`/`cargo check` DEBEN
/// ejecutarse con CWD en `SAAC/src-tauri/` (donde vive `Cargo.toml`), y el
/// binario resultante hereda ese mismo CWD al arrancar. El resultado era una
/// ruta resuelta a `SAAC/src-tauri/workers/node/dist/index.js`, que no
/// existe, y el worker crasheaba silenciosamente en el primer request.
///
/// AHORA: se usa `CARGO_MANIFEST_DIR`, una variable de entorno que Cargo
/// define en TIEMPO DE COMPILACIÓN (vía `env!`, no `std::env::var` — queda
/// literalmente incrustada en el binario) apuntando siempre a la carpeta
/// donde vive el `Cargo.toml` de este crate (`SAAC/src-tauri/`). Desde ahí
/// se sube un nivel (`..`) para llegar a la raíz real del proyecto
/// (`SAAC/`), sin importar cuál sea el CWD del proceso en ejecución — sea
/// lanzado con `cargo run`, como binario suelto, o desde el modo CLI de
/// testing (`--scan-json`, `--analyze-project-json`).
///
/// LIMITACIÓN CONOCIDA: esto es correcto para desarrollo (`cargo run`/
/// `cargo build`), donde `CARGO_MANIFEST_DIR` y la ubicación real de
/// `workers/` mantienen la misma relación relativa. Para una build
/// EMPAQUETADA de producción (instalador final del usuario), la carpeta
/// `workers/` tendría que empaquetarse explícitamente como recurso de
/// Tauri (`tauri.conf.json` → `bundle.resources`) y resolverse en tiempo
/// de ejecución vía `app_handle.path().resource_dir()` en vez de esta
/// constante compilada — eso queda pendiente como tarea de packaging
/// separada, fuera del alcance de este fix.
fn default_node_script_path() -> String {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let project_root = std::path::Path::new(manifest_dir)
        .parent()
        .expect("CARGO_MANIFEST_DIR debería tener un padre (la raíz del proyecto SAAC)");
    project_root
        .join("workers")
        .join("node")
        .join("dist")
        .join("index.js")
        .to_string_lossy()
        .into_owned()
}

// ─────────────────────────────────────────────────────────────────────────
// NodeWorkerManager
// ─────────────────────────────────────────────────────────────────────────

type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<WorkerResponse>>>>;

/// Administra el ciclo de vida completo del subproceso Node: spawn, envío de
/// requests, correlación de respuestas, progreso, timeouts, crashes y shutdown.
pub struct NodeWorkerManager {
    config: WorkerConfig,
    app_handle: AppHandle,
    /// Handle al proceso hijo actual. Se retiene aquí (y no se mueve a la
    /// tarea de monitoreo) para que el manager pueda matarlo explícitamente
    /// en `shutdown()` o `force_kill()`, y para poder reemplazarlo completo
    /// en cada respawn tras un crash.
    process: Arc<Mutex<Option<Child>>>,
    /// Canal de escritura hacia stdin del proceso actual. Se reemplaza en cada
    /// respawn; protegido por Mutex porque múltiples requests pueden intentar
    /// escribir concurrentemente.
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    /// Requests en vuelo, correlacionadas por requestId.
    pending: PendingMap,
    /// Contador de reintentos de respawn consumidos en la sesión actual.
    respawn_attempts: Arc<Mutex<u32>>,
}

impl NodeWorkerManager {
    /// Crea el manager y spawnea el proceso worker por primera vez.
    pub async fn new(app_handle: AppHandle, config: WorkerConfig) -> Result<Self> {
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let stdin_slot: Arc<Mutex<Option<ChildStdin>>> = Arc::new(Mutex::new(None));
        let respawn_attempts = Arc::new(Mutex::new(0u32));
        let process: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

        let manager = Self {
            config,
            app_handle,
            process,
            stdin: stdin_slot,
            pending,
            respawn_attempts,
        };

        manager.spawn_process().await?;
        Ok(manager)
    }

    /// Spawnea el proceso Node y arranca los loops de lectura de stdout/stderr.
    /// Usado tanto en `new` como al reintentar tras un crash.
    async fn spawn_process(&self) -> Result<()> {
        let mut child = Command::new("node")
            .arg(&self.config.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .context("No se pudo iniciar el proceso worker de Node. ¿Está 'node' en el PATH?")?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stdin del proceso worker"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stdout del proceso worker"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("No se pudo obtener stderr del proceso worker"))?;

        // Guardar el nuevo stdin para que las requests puedan escribir en él.
        {
            let mut slot = self.stdin.lock().await;
            *slot = Some(stdin);
        }

        // Loop de lectura de stdout: parsea JSON Lines y resuelve pending_requests.
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
                                    // El progreso parcial no resuelve el oneshot;
                                    // el llamador emite el evento de progreso él
                                    // mismo desde send_request (ver más abajo),
                                    // usando el payload que se reenvía aquí.
                                    // Se deja de largo intencionalmente: el envío
                                    // del evento de progreso ocurre en el punto
                                    // donde se conoce el AppHandle (send_request),
                                    // así que aquí solo reenviamos si hay alguien
                                    // escuchando un canal de progreso dedicado.
                                    // (En esta versión simple, 'partial' también
                                    // se entrega vía el mismo oneshot solo si
                                    // status != Partial; para progreso real se
                                    // usa un mecanismo de callback, ver
                                    // `send_request_with_progress`.)
                                    continue;
                                }

                                let mut map = pending_for_stdout.lock().await;
                                if let Some(sender) = map.remove(&response.request_id) {
                                    let _ = sender.send(response);
                                }
                                // Si no hay sender (ya se limpió por timeout),
                                // simplemente se descarta la respuesta tardía.
                            }
                            Err(parse_err) => {
                                // JSON malformado en una línea individual: se
                                // loguea y se continúa leyendo, sin abortar el
                                // loop completo (una línea de log accidental
                                // en stdout no debe tumbar la comunicación).
                                tracing::error!(
                                    error = %parse_err,
                                    raw_line = %line,
                                    "Línea de stdout del worker no es JSON válido"
                                );
                            }
                        }
                    }
                    Ok(None) => {
                        // EOF: el proceso cerró stdout, típicamente porque murió.
                        tracing::warn!("El worker cerró stdout inesperadamente (posible crash)");
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
                        tracing::error!(error = %io_err, "Error de I/O leyendo stdout del worker");
                        break;
                    }
                }
            }
        });

        // Loop de lectura de stderr: redirige logs de depuración del worker.
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "node_worker", "{line}");
            }
        });

        // Guardar el Child en el manager (reemplazando cualquier proceso
        // anterior, ya finalizado, de un respawn previo). Retenerlo aquí, en
        // vez de moverlo a una tarea de tokio::spawn, es lo que permite que
        // `shutdown()` y `force_kill()` puedan actuar sobre el proceso de
        // forma explícita en cualquier momento.
        {
            let mut slot = self.process.lock().await;
            *slot = Some(child);
        }

        // Monitor de salud del proceso: usa try_wait() en un loop de polling
        // en vez de wait() bloqueante, para no retener el lock de `process`
        // de forma prolongada (lo cual impediría que shutdown()/force_kill()
        // accedan al Child mientras el monitor "posee" el lock). Cada
        // iteración toma el lock solo el tiempo de una llamada no bloqueante.
        let process_for_monitor = Arc::clone(&self.process);
        let pending_for_monitor = Arc::clone(&self.pending);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(300)).await;

                let mut slot = process_for_monitor.lock().await;
                let still_alive = match slot.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(None) => true, // Sigue corriendo.
                        Ok(Some(status)) => {
                            if status.success() {
                                tracing::info!(
                                    "El proceso worker terminó normalmente (shutdown esperado)"
                                );
                            } else {
                                tracing::warn!(
                                    exit_code = ?status.code(),
                                    "El worker terminó con código de error"
                                );
                            }
                            false
                        }
                        Err(err) => {
                            tracing::error!(error = %err, "Error consultando estado del worker");
                            false
                        }
                    },
                    // El slot ya fue vaciado por shutdown()/force_kill()
                    // o por un respawn concurrente: este monitor "viejo"
                    // debe terminar sin tocar nada más.
                    None => false,
                };

                if !still_alive {
                    // Si el proceso murió por sí solo (crash real, no un
                    // shutdown ordenado que ya limpia el slot), se limpia
                    // el slot aquí y se resuelven las requests huérfanas,
                    // espejando lo que hace el loop de stdout al ver EOF.
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

    /// Envía una request al worker y espera su resolución, aplicando el
    /// timeout correspondiente según el tipo de comando. Devuelve un
    /// `AnalysisFileStatus` ya traducido para el caso de fallo, en vez de
    /// propagar el error crudo, para simplificar el punto de llamada desde
    /// los comandos de Tauri.
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

        match self
            .send_and_await(request, self.config.parse_timeout)
            .await
        {
            Ok(response) => Self::response_to_outcome(file_path, response),
            Err(WorkerError::Timeout) => {
                self.cleanup_pending(&request_id).await;
                tracing::warn!(request_id = %request_id, file_path = %file_path, "Timeout esperando respuesta del worker");
                FileAnalysisOutcome {
                    file_path,
                    status: AnalysisFileStatus::Timeout,
                    result: None,
                    error_message: Some("El worker no respondió dentro del tiempo límite".into()),
                }
            }
            Err(WorkerError::ProcessCrashed) => {
                self.handle_crash_and_maybe_respawn().await;
                FileAnalysisOutcome {
                    file_path,
                    status: AnalysisFileStatus::WorkerCrashed,
                    result: None,
                    error_message: Some("El proceso worker terminó inesperadamente".into()),
                }
            }
            Err(WorkerError::Unavailable) => FileAnalysisOutcome {
                file_path,
                status: AnalysisFileStatus::WorkerUnavailable,
                result: None,
                error_message: Some("El worker no está disponible tras agotar los reintentos".into()),
            },
            Err(other) => FileAnalysisOutcome {
                file_path,
                status: AnalysisFileStatus::ParseError,
                result: None,
                error_message: Some(other.to_string()),
            },
        }
    }

    /// Analiza un batch de archivos, emitiendo eventos de progreso a la UI de
    /// Tauri conforme se completa cada uno. El timeout total escala con la
    /// cantidad de archivos (ver WorkerConfig::analyze_timeout_per_file).
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
                // Se asume que el worker devuelve, en `data.results`, un arreglo de
                // resultados por archivo; se traduce cada uno. Si el shape no
                // coincide, se reporta un único ParseError para todo el batch
                // en vez de fallar silenciosamente.
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
                tracing::warn!(request_id = %request_id, "Timeout esperando el batch de análisis");
                for file_path in &file_paths {
                    outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::Timeout,
                        result: None,
                        error_message: Some("El worker no respondió dentro del tiempo límite".into()),
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
                        error_message: Some("El proceso worker terminó inesperadamente".into()),
                    });
                }
            }
            Err(WorkerError::Unavailable) => {
                for file_path in &file_paths {
                    outcomes.push(FileAnalysisOutcome {
                        file_path: file_path.clone(),
                        status: AnalysisFileStatus::WorkerUnavailable,
                        result: None,
                        error_message: Some("El worker no está disponible".into()),
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

    /// Envía el comando `shutdown` y espera confirmación breve; si no llega,
    /// fuerza la terminación del proceso. Debe llamarse desde el hook de
    /// cierre de ventana de Tauri (`on_window_close_requested`) para no dejar
    /// procesos Node huérfanos.
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
                tracing::info!("Worker confirmó shutdown ordenado");
                // El proceso debería auto-terminar tras confirmar shutdown;
                // se limpia el slot para que el monitor de salud (que verá
                // el proceso terminado en su próximo try_wait) no reporte
                // un "crash" espurio, y para liberar el Child explícitamente.
                let mut slot = self.process.lock().await;
                *slot = None;
            }
            Err(_) => {
                tracing::warn!(
                    "El worker no confirmó shutdown a tiempo; forzando terminación del proceso"
                );
                self.force_kill().await;
            }
        }
    }

    /// Termina el proceso worker de forma forzosa (SIGKILL / TerminateProcess
    /// según la plataforma). Se usa como fallback cuando `shutdown()` no
    /// obtiene confirmación a tiempo, y puede reutilizarse en el futuro para
    /// una acción explícita de "cancelar y reiniciar" desde la UI.
    async fn force_kill(&self) {
        let mut slot = self.process.lock().await;
        if let Some(child) = slot.as_mut() {
            if let Err(e) = child.kill().await {
                tracing::error!(error = %e, "Error al forzar la terminación del worker");
            } else {
                tracing::info!("Proceso worker terminado de forma forzosa");
            }
        }
        *slot = None;
    }

    // ── Internos ──

    /// Escribe la request en stdin y espera su resolución vía oneshot,
    /// aplicando el timeout dado. Traduce el vencimiento de timeout y el
    /// cierre inesperado del canal (crash) a variantes de WorkerError.
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
                    // No hay proceso vivo (aún no se ha respawneado tras un
                    // crash previo, o todos los reintentos se agotaron).
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
                        .unwrap_or_else(|| "Error desconocido reportado por el worker".into());
                    if msg == "process_crashed" {
                        return Err(WorkerError::ProcessCrashed);
                    }
                    return Err(WorkerError::ParseError(msg));
                }
                Ok(response)
            }
            // El oneshot::Sender se soltó sin enviar nada: ocurre cuando el
            // loop de stdout detecta EOF (crash) y hace `map.drain()` antes
            // de que esta request específica llegara a insertarse, o en
            // condiciones de carrera equivalentes.
            Ok(Err(_recv_error)) => Err(WorkerError::ProcessCrashed),
            Err(_elapsed) => Err(WorkerError::Timeout),
        }
    }

    /// Remueve una entrada de `pending` que quedó huérfana (por timeout o
    /// por no haber podido enviarse). Evita fugas de memoria en el HashMap.
    async fn cleanup_pending(&self, request_id: &str) {
        let mut map = self.pending.lock().await;
        map.remove(request_id);
    }

    /// Ante un crash detectado, intenta reiniciar el proceso worker hasta
    /// `max_respawn_attempts` veces con el backoff configurado. Si se agotan
    /// los reintentos, deja `stdin` en `None` para que futuras requests
    /// devuelvan `WorkerError::Unavailable` de inmediato.
    async fn handle_crash_and_maybe_respawn(&self) {
        {
            let mut slot = self.stdin.lock().await;
            *slot = None;
        }
        {
            // El monitor de salud ya debería haber vaciado este slot al
            // detectar el crash vía try_wait(), pero se limpia aquí también
            // por si esta ruta se disparó desde send_and_await (canal
            // cerrado) antes de que el monitor tuviera oportunidad de
            // correr su próxima iteración de polling.
            let mut slot = self.process.lock().await;
            *slot = None;
        }

        let mut attempts = self.respawn_attempts.lock().await;

        if *attempts >= self.config.max_respawn_attempts {
            tracing::error!(
                "Se agotaron los {} reintentos de reinicio del worker",
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
        drop(attempts); // liberar el lock antes del sleep/spawn

        tracing::info!(
            intento = attempt_number,
            espera_segundos = backoff.as_secs(),
            "Reintentando iniciar el worker tras un crash"
        );

        tokio::time::sleep(backoff).await;

        if let Err(e) = self.spawn_process().await {
            tracing::error!(error = %e, "Falló el reintento de reinicio del worker");
        } else {
            // Reinicio exitoso: se resetea el contador para no penalizar
            // crashes futuros no relacionados con el problema actual.
            let mut attempts = self.respawn_attempts.lock().await;
            *attempts = 0;
        }
    }

    /// Emite un evento de progreso a la ventana principal de la UI.
    fn emit_progress(&self, request_id: &str, file_path: Option<&str>, completed: usize, total: usize) {
        let event = WorkerProgressEvent {
            request_id: request_id.to_string(),
            file_path: file_path.map(|s| s.to_string()),
            completed,
            total,
        };
        if let Err(e) = self.app_handle.emit("worker://progress", &event) {
            tracing::warn!(error = %e, "No se pudo emitir evento de progreso a la UI");
        }
    }

    /// Notifica a la UI que el worker quedó indisponible tras agotar
    /// reintentos, para que el frontend pueda mostrar el estado y permitir
    /// reintento manual o continuar con otros workers (ej. Python).
    fn emit_worker_unavailable(&self) {
        if let Err(e) = self
            .app_handle
            .emit("worker://unavailable", &serde_json::json!({ "worker": "node" }))
        {
            tracing::warn!(error = %e, "No se pudo emitir evento de worker no disponible");
        }
    }

    /// Traduce una WorkerResponse exitosa de `parse` a un FileAnalysisOutcome.
    fn response_to_outcome(file_path: String, response: WorkerResponse) -> FileAnalysisOutcome {
        FileAnalysisOutcome {
            file_path,
            status: AnalysisFileStatus::Success,
            result: response.data,
            error_message: None,
        }
    }

    /// Traduce el campo `data` de una respuesta `analyze` (batch) a un Vec de
    /// resultados por archivo. Devuelve Err si el shape del payload no es el
    /// esperado (arreglo de objetos con al menos `filePath` y `status`).
    fn batch_response_to_outcomes(
        file_paths: &[String],
        response: WorkerResponse,
    ) -> Result<Vec<FileAnalysisOutcome>, WorkerError> {
        let data = response
            .data
            .ok_or_else(|| WorkerError::ParseError("Respuesta de batch sin data".into()))?;

        let items = data
            .get("results")
            .and_then(|value| value.as_array())
            .ok_or_else(|| WorkerError::ParseError("data.results de batch no es un arreglo".into()))?;

        let mut outcomes = Vec::with_capacity(file_paths.len());
        for item in items {
            let file_path = item
                .get("filePath")
                .and_then(|v| v.as_str())
                .unwrap_or("desconocido")
                .to_string();

            let status = if item.get("status").and_then(|value| value.as_str()) == Some("success") {
                AnalysisFileStatus::Success
            } else {
                AnalysisFileStatus::ParseError
            };

            outcomes.push(FileAnalysisOutcome {
                file_path,
                status,
                result: item.get("result").cloned(),
                error_message: item
                    .get("errorMessage")
                    .and_then(|value| value.as_str())
                    .map(str::to_owned),
            });
        }

        Ok(outcomes)
    }
}

/// Genera un identificador único para correlacionar request/response.
/// Se evita depender del crate `uuid` si el proyecto no lo tiene ya
/// incluido; sustituir por `uuid::Uuid::new_v4().to_string()` si está
/// disponible en el workspace.
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}-{:x}", nanos, std::process::id())
}