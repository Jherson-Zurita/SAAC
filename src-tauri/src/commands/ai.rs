// src-tauri/src/commands/ai.rs — Comandos Tauri IPC para Inteligencia Artificial Local.

use crate::engine::ai_client::{
    AiClient, AiConfig, AiContextType, AiResponse, AiStatusResult,
};
use crate::engine::amg::ArchitectureModelGraph;

#[tauri::command]
pub async fn check_ai_status(config: Option<AiConfig>) -> Result<AiStatusResult, String> {
    let config = config.unwrap_or_default();
    Ok(AiClient::check_status(&config).await)
}

#[tauri::command]
pub async fn ask_ai(
    prompt: String,
    context_type: Option<String>,
    target_id: Option<String>,
    config: Option<AiConfig>,
    amg: Option<ArchitectureModelGraph>,
) -> Result<AiResponse, String> {
    let config = config.unwrap_or_default();
    let ctx = AiContextType::from_str_opt(context_type.as_deref(), target_id.as_deref());

    AiClient::ask(&prompt, &ctx, amg.as_ref(), &config).await
}
