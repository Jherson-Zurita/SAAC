//! types.rs — Estructuras comunes compartidas entre los workers (Node/Python) y los comandos de Tauri.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Comando soportado por el protocolo JSON Lines de los workers.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WorkerCommand {
    Parse,
    Analyze,
    Shutdown,
}

/// Payload para el comando `parse`: un único archivo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsePayload {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(rename = "fileHash", skip_serializing_if = "Option::is_none")]
    pub file_hash: Option<String>,
}

/// Payload para el comando `analyze`: batch de archivos.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzePayload {
    pub files: Vec<ParsePayload>,
}

/// Solicitud enviada al worker por stdin (una línea JSON).
#[derive(Debug, Clone, Serialize)]
pub struct WorkerRequest {
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub command: WorkerCommand,
    pub payload: Value,
}

/// Estado reportado en cada línea de respuesta del worker.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkerStatus {
    Partial,
    Success,
    Error,
}

/// Respuesta cruda del worker por stdout (una línea JSON = un WorkerResponse).
#[derive(Debug, Clone, Deserialize)]
pub struct WorkerResponse {
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub status: WorkerStatus,
    #[serde(default)]
    pub data: Option<Value>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub progress: Option<WorkerProgress>,
}

/// Progreso reportado por un worker durante un comando `analyze`.
#[derive(Debug, Clone, Deserialize)]
pub struct WorkerProgress {
    pub processed: usize,
    pub total: usize,
    #[serde(rename = "currentFile")]
    pub current_file: Option<String>,
}

/// Estado de análisis por archivo expuesto al frontend.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisFileStatus {
    Success,
    Timeout,
    WorkerCrashed,
    ParseError,
    WorkerUnavailable,
}

/// Evento de progreso emitido a la UI mientras corre un batch.
#[derive(Debug, Clone, Serialize)]
pub struct WorkerProgressEvent {
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    pub completed: usize,
    pub total: usize,
}

/// Resultado final por archivo, incluyendo el caso de error explícito.
#[derive(Debug, Clone, Serialize)]
pub struct FileAnalysisOutcome {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub status: AnalysisFileStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Resultado agregado de `analyze_project`, retornado al frontend.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectAnalysisResult {
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
    pub successful: usize,
    pub failed: usize,
    pub skipped: usize,
    pub outcomes: Vec<FileAnalysisOutcome>,
    #[serde(rename = "skippedFiles")]
    pub skipped_files: Vec<SkippedFile>,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    /// `true` si el análisis fue interrumpido por `cancel_analysis` antes de
    /// procesar todos los archivos. En ese caso `outcomes` contiene solo los
    /// archivos que alcanzaron a completarse antes de la cancelación.
    pub cancelled: bool,
    /// El grafo de arquitectura resultante compilado a partir de los outcomes (si no fue cancelado)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amg: Option<crate::engine::amg::ArchitectureModelGraph>,
}

/// Archivo excluido del análisis por tamaño o lenguaje no soportado.
#[derive(Debug, Clone, Serialize)]
pub struct SkippedFile {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub reason: String,
}

/// Evento de progreso a nivel de proyecto emitido a la UI durante `analyze_project`.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectProgressEvent {
    pub phase: String,
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
    #[serde(rename = "completedFiles")]
    pub completed_files: usize,
    #[serde(rename = "nodeFiles")]
    pub node_files: usize,
    #[serde(rename = "pythonFiles")]
    pub python_files: usize,
    #[serde(rename = "skippedFiles")]
    pub skipped_files: usize,
    #[serde(rename = "currentFile")]
    pub current_file: Option<String>,
}