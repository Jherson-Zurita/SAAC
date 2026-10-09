// src-tauri/src/commands/ai.rs — Comandos Tauri IPC para Inteligencia Artificial Local.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::State;

use crate::engine::ai_client::{
    AiClient, AiConfig, AiContextType, AiResponse, AiStatusResult, AiStreamEvent, AiStreamSummary,
    CancelSignal,
};
use crate::engine::amg::ArchitectureModelGraph;
use crate::engine::secrets;

/// Streams de IA en curso, por `request_id`, para poder cancelarlos.
#[derive(Default)]
pub struct AiStreamRegistry(Mutex<HashMap<String, Arc<CancelSignal>>>);

struct RegisteredStream<'a> {
    registry: &'a AiStreamRegistry,
    request_id: String,
}

impl Drop for RegisteredStream<'_> {
    fn drop(&mut self) {
        if let Ok(mut streams) = self.registry.0.lock() {
            streams.remove(&self.request_id);
        }
    }
}

/// Completa `api_key` con la guardada en el almacén seguro si el frontend no
/// envió una (solo la envía al probar una key recién escrita, antes de guardarla).
fn resolve_config(config: Option<AiConfig>) -> AiConfig {
    let mut config = config.unwrap_or_default();
    if config.api_key.as_deref().map_or(true, |key| key.trim().is_empty()) {
        config.api_key = secrets::get_ai_api_key();
    }
    config
}

#[tauri::command]
pub async fn check_ai_status(config: Option<AiConfig>) -> Result<AiStatusResult, String> {
    let config = resolve_config(config);
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
    let config = resolve_config(config);
    let ctx = AiContextType::from_str_opt(context_type.as_deref(), target_id.as_deref());

    AiClient::ask(&prompt, &ctx, amg.as_ref(), &config).await
}

/// Como `ask_ai`, pero envía el texto por `on_event` a medida que se genera.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ask_ai_stream(
    registry: State<'_, AiStreamRegistry>,
    request_id: String,
    prompt: String,
    context_type: Option<String>,
    target_id: Option<String>,
    config: Option<AiConfig>,
    amg: Option<ArchitectureModelGraph>,
    on_event: Channel<AiStreamEvent>,
) -> Result<AiStreamSummary, String> {
    let config = resolve_config(config);
    let ctx = AiContextType::from_str_opt(context_type.as_deref(), target_id.as_deref());

    let cancel = Arc::new(CancelSignal::default());
    {
        let mut streams = registry.0.lock().map_err(|e| e.to_string())?;
        if streams.contains_key(&request_id) {
            return Err(format!("Ya existe una consulta de IA con id '{}'.", request_id));
        }
        streams.insert(request_id.clone(), cancel.clone());
    }
    let _registered = RegisteredStream { registry: &registry, request_id };

    let summary = AiClient::ask_stream(&prompt, &ctx, amg.as_ref(), &config, &cancel, |content| {
        on_event
            .send(AiStreamEvent::Delta { content })
            .map_err(|e| format!("No se pudo enviar el fragmento al frontend: {}", e))
    })
    .await?;
    // Los mensajes del canal pueden llegar después de la respuesta del comando:
    // el frontend da la respuesta por terminada al recibir `Done`, no al resolver.
    let _ = on_event.send(AiStreamEvent::Done(summary.clone()));
    Ok(summary)
}

/// Detiene una respuesta en streaming. Devuelve si había un stream con ese id.
#[tauri::command]
pub fn cancel_ai_stream(registry: State<'_, AiStreamRegistry>, request_id: String) -> bool {
    let signal = registry.0.lock().ok().and_then(|streams| streams.get(&request_id).cloned());
    match signal {
        Some(signal) => {
            signal.cancel();
            true
        }
        None => false,
    }
}

/// Guarda la API key en el almacén seguro del sistema; `None` o vacía la elimina.
/// Devuelve si queda una key guardada.
#[tauri::command]
pub fn set_ai_api_key(api_key: Option<String>) -> Result<bool, String> {
    match api_key.as_deref().map(str::trim).filter(|key| !key.is_empty()) {
        Some(key) => secrets::set_ai_api_key(key).map(|_| true),
        None => secrets::delete_ai_api_key().map(|_| false),
    }
}

/// Indica si hay una API key guardada, sin devolverla.
#[tauri::command]
pub fn has_ai_api_key() -> bool {
    secrets::get_ai_api_key().is_some()
}
