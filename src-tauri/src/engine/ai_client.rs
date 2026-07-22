//! ai_client.rs — Cliente de Inteligencia Artificial Local (Ollama & OpenAI Compatible).
//!
//! §4.5 / Capítulo 6 de la especificación SAAC v2.0:
//! Conecta el Architecture Model Graph (AMG) con modelos de lenguaje locales
//! (Ollama /api/chat, LM Studio /v1/chat/completions, vLLM) o responde en modo
//! simulado/fallback cuando no se detecta un LLM en ejecución en la máquina.

use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::engine::amg::ArchitectureModelGraph;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AiProvider {
    Ollama,
    OpenAiCompatible,
    Mock,
}

impl Default for AiProvider {
    fn default() -> Self {
        AiProvider::Ollama
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    #[serde(default)]
    pub provider: AiProvider,
    pub endpoint_url: String,
    pub model_name: String,
    pub temperature: Option<f64>,
    pub timeout_seconds: Option<u64>,
    pub api_key: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        AiConfig {
            provider: AiProvider::Ollama,
            endpoint_url: "http://localhost:11434".to_string(),
            model_name: "qwen2.5-coder".to_string(),
            temperature: Some(0.2),
            timeout_seconds: Some(60),
            api_key: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatusResult {
    pub is_online: bool,
    pub provider: AiProvider,
    pub endpoint_url: String,
    pub available_models: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub content: String,
    pub model_used: String,
    pub provider_used: AiProvider,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub is_mock_fallback: bool,
    pub generated_prompt: String,
}

#[derive(Debug, Clone)]
pub enum AiContextType {
    FullAmg,
    ModuleDetail(String),
    AntipatternDetail(String),
}

impl AiContextType {
    pub fn from_str_opt(ctx_type: Option<&str>, target_id: Option<&str>) -> Self {
        match ctx_type.unwrap_or("amg") {
            "module" => {
                AiContextType::ModuleDetail(target_id.unwrap_or_default().to_string())
            }
            "antipattern" => {
                AiContextType::AntipatternDetail(target_id.unwrap_or_default().to_string())
            }
            _ => AiContextType::FullAmg,
        }
    }
}

pub struct AiClient;

impl AiClient {
    /// Comprueba de forma ligera (timeout 5s) si el servidor de IA está online
    /// y lista los modelos disponibles.
    pub async fn check_status(config: &AiConfig) -> AiStatusResult {
        if config.provider == AiProvider::Mock {
            return AiStatusResult {
                is_online: true,
                provider: AiProvider::Mock,
                endpoint_url: "mock://local".to_string(),
                available_models: vec!["mock-architect-v1".to_string()],
                message: "Modo simulado activo. Listo para pruebas E2E.".to_string(),
            };
        }

        let timeout = Duration::from_secs(5);
        let client = match reqwest::Client::builder().timeout(timeout).build() {
            Ok(c) => c,
            Err(e) => {
                return AiStatusResult {
                    is_online: false,
                    provider: config.provider,
                    endpoint_url: config.endpoint_url.clone(),
                    available_models: Vec::new(),
                    message: format!("Error al crear cliente HTTP: {}", e),
                }
            }
        };

        match config.provider {
            AiProvider::Ollama => {
                let tags_url = format!("{}/api/tags", config.endpoint_url.trim_end_matches('/'));
                match client.get(&tags_url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        #[derive(Deserialize)]
                        struct OllamaModel {
                            name: String,
                        }
                        #[derive(Deserialize)]
                        struct OllamaTags {
                            models: Option<Vec<OllamaModel>>,
                        }

                        let models = resp
                            .json::<OllamaTags>()
                            .await
                            .ok()
                            .and_then(|t| t.models)
                            .unwrap_or_default()
                            .into_iter()
                            .map(|m| m.name)
                            .collect();

                        AiStatusResult {
                            is_online: true,
                            provider: AiProvider::Ollama,
                            endpoint_url: config.endpoint_url.clone(),
                            available_models: models,
                            message: "Servidor Ollama detectado y listo.".to_string(),
                        }
                    }
                    Ok(resp) => AiStatusResult {
                        is_online: false,
                        provider: AiProvider::Ollama,
                        endpoint_url: config.endpoint_url.clone(),
                        available_models: Vec::new(),
                        message: format!("Ollama respondió con HTTP status {}", resp.status()),
                    },
                    Err(e) => AiStatusResult {
                        is_online: false,
                        provider: AiProvider::Ollama,
                        endpoint_url: config.endpoint_url.clone(),
                        available_models: Vec::new(),
                        message: format!("No se pudo conectar a Ollama: {}", e),
                    },
                }
            }
            AiProvider::OpenAiCompatible | AiProvider::Mock => {
                let models_url = format!("{}/models", config.endpoint_url.trim_end_matches('/'));
                let mut req = client.get(&models_url);
                if let Some(ref key) = config.api_key {
                    req = req.header("Authorization", format!("Bearer {}", key));
                }

                match req.send().await {
                    Ok(resp) if resp.status().is_success() => {
                        #[derive(Deserialize)]
                        struct OpenAiModel {
                            id: String,
                        }
                        #[derive(Deserialize)]
                        struct OpenAiList {
                            data: Option<Vec<OpenAiModel>>,
                        }

                        let models = resp
                            .json::<OpenAiList>()
                            .await
                            .ok()
                            .and_then(|l| l.data)
                            .unwrap_or_default()
                            .into_iter()
                            .map(|m| m.id)
                            .collect();

                        AiStatusResult {
                            is_online: true,
                            provider: config.provider,
                            endpoint_url: config.endpoint_url.clone(),
                            available_models: models,
                            message: "Servidor OpenAI-Compatible detectado y listo.".to_string(),
                        }
                    }
                    Ok(resp) => AiStatusResult {
                        is_online: false,
                        provider: config.provider,
                        endpoint_url: config.endpoint_url.clone(),
                        available_models: Vec::new(),
                        message: format!("API respondió con HTTP status {}", resp.status()),
                    },
                    Err(e) => AiStatusResult {
                        is_online: false,
                        provider: config.provider,
                        endpoint_url: config.endpoint_url.clone(),
                        available_models: Vec::new(),
                        message: format!("No se pudo conectar al endpoint API: {}", e),
                    },
                }
            }
        }
    }

    /// Construye los mensajes formateados (system_prompt y user_prompt)
    /// inyectando el contexto relevante del AMG.
    pub fn build_prompt(
        user_prompt: &str,
        context_type: &AiContextType,
        amg: Option<&ArchitectureModelGraph>,
    ) -> (String, String) {
        let system_message =
            "Eres un Arquitecto de Software experto asesorando al usuario sobre el modelo de \
             arquitectura de su proyecto en SAAC v2.0. Responde con lenguaje claro, riguroso, \
             priorizando principios SOLID, acoplamiento, cohesión y patrones de diseño."
                .to_string();

        let context_str = match (context_type, amg) {
            (AiContextType::FullAmg, Some(amg)) => {
                let mut ap_summary = String::new();
                for ap in &amg.antipatterns {
                    ap_summary.push_str(&format!(
                        "- [{:?}] {}: {}\n",
                        ap.severity, ap.name, ap.description
                    ));
                }
                if ap_summary.is_empty() {
                    ap_summary = "Ningún antipatrón crítico detectado.".to_string();
                }

                format!(
                    "### CONTEXTO ARQUITECTÓNICO DEL PROYECTO\n\
                     - Nombre Proyecto: {}\n\
                     - Tipo Detectado: {:?}\n\
                     - Estilo Arquitectónico: {:?} (Confianza: {:.0}%)\n\
                     - Total Módulos: {}\n\
                     - Total Dependencias: {}\n\
                     - Mantenibilidad Promedio: {:.1}\n\
                     - Instabilidad Promedio: {:.2}\n\
                     - Distancia Promedio: {:.2}\n\n\
                     ### ANTIPATRONES DETECTADOS:\n{}\n",
                    amg.project_name,
                    amg.detected_type,
                    amg.detected_style,
                    amg.style_confidence * 100.0,
                    amg.metrics.total_modules,
                    amg.metrics.total_dependencies,
                    amg.metrics.maintainability_index_avg,
                    amg.metrics.avg_instability,
                    amg.metrics.avg_distance,
                    ap_summary
                )
            }
            (AiContextType::ModuleDetail(target_id), Some(amg)) => {
                if let Some(m) = amg.modules.iter().find(|m| m.id == *target_id) {
                    format!(
                        "### CONTEXTO DEL MÓDULO '{}'\n\
                         - Lenguaje: {:?}\n\
                         - Tipo: {:?}\n\
                         - LOC: {}, LLOC: {}\n\
                         - Acoplamiento: Ce={}, Ca={}\n\
                         - Cohesión: {:.2}\n\
                         - Clases ({}): {}\n\
                         - Imports: {:?}\n",
                        m.name,
                        m.language,
                        m.module_type,
                        m.loc,
                        m.lloc,
                        m.metrics.ce,
                        m.metrics.ca,
                        m.metrics.module_cohesion,
                        m.classes.len(),
                        m.classes
                            .iter()
                            .map(|c| c.name.as_str())
                            .collect::<Vec<&str>>()
                            .join(", "),
                        m.imports
                    )
                } else {
                    format!("### CONTEXTO MÓDULO: ID '{}' no encontrado.", target_id)
                }
            }
            (AiContextType::AntipatternDetail(target_id), Some(amg)) => {
                if let Some(ap) = amg.antipatterns.iter().find(|ap| ap.id == *target_id) {
                    format!(
                        "### CONTEXTO DEL ANTIPATRÓN '{}'\n\
                         - Tipo: {:?}\n\
                         - Severidad: {:?}\n\
                         - Descripción: {}\n\
                         - Ruta del ciclo / Punto de quiebre: {:?}\n\
                         - Refactorización Sugerida: {:?}\n",
                        ap.name,
                        ap.antipattern_type,
                        ap.severity,
                        ap.description,
                        ap.suggested_break_point,
                        ap.refactor_suggestion
                    )
                } else {
                    format!("### CONTEXTO ANTIPATRÓN: ID '{}' no encontrado.", target_id)
                }
            }
            _ => "### CONTEXTO GENERAL: No hay AMG cargado.".to_string(),
        };

        let full_user_message = format!("{}\n### CONSULTA DEL USUARIO:\n{}", context_str, user_prompt);
        (system_message, full_user_message)
    }

    /// Ejecuta la consulta al servidor de IA o retoma la respuesta simulada
    /// en modo offline/fallback.
    pub async fn ask(
        user_prompt: &str,
        context_type: &AiContextType,
        amg: Option<&ArchitectureModelGraph>,
        config: &AiConfig,
    ) -> Result<AiResponse, String> {
        let (system_msg, full_user_msg) = Self::build_prompt(user_prompt, context_type, amg);

        // 1. Si está en proveedor Mock, responder directo con mock
        if config.provider == AiProvider::Mock {
            return Ok(Self::make_mock_response(
                user_prompt,
                &system_msg,
                &full_user_msg,
                config,
            ));
        }

        // 2. Si no es Mock, intentar conectarse con timeout
        let status = Self::check_status(config).await;
        if !status.is_online {
            // Fallback elegante cuando el servidor local no está disponible
            let mut mock_resp = Self::make_mock_response(
                user_prompt,
                &system_msg,
                &full_user_msg,
                config,
            );
            mock_resp.content = format!(
                "⚠️ [MODO OFFLINE DE IA - FALLBACK ELEGANTE]\n\n\
                 No se detectó un servidor LLM en ejecución en '{}'. {}\n\n\
                 El contexto de arquitectura fue construido exitosamente y está listo para enviarse:\n\n\
                 {}",
                config.endpoint_url, status.message, full_user_msg
            );
            return Ok(mock_resp);
        }

        // 3. Servidor Online: enviar la petición real
        let timeout_secs = config.timeout_seconds.unwrap_or(60);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .map_err(|e| format!("Error cliente HTTP: {}", e))?;

        match config.provider {
            AiProvider::Ollama => {
                let chat_url = format!("{}/api/chat", config.endpoint_url.trim_end_matches('/'));

                #[derive(Serialize)]
                struct Message {
                    role: String,
                    content: String,
                }
                #[derive(Serialize)]
                struct OllamaChatReq {
                    model: String,
                    messages: Vec<Message>,
                    stream: bool,
                }

                let req_body = OllamaChatReq {
                    model: config.model_name.clone(),
                    messages: vec![
                        Message {
                            role: "system".to_string(),
                            content: system_msg.clone(),
                        },
                        Message {
                            role: "user".to_string(),
                            content: full_user_msg.clone(),
                        },
                    ],
                    stream: false,
                };

                let resp = client
                    .post(&chat_url)
                    .json(&req_body)
                    .send()
                    .await
                    .map_err(|e| format!("Error en petición HTTP a Ollama: {}", e))?;

                if !resp.status().is_success() {
                    return Err(format!("Ollama devolvió código de error HTTP {}", resp.status()));
                }

                #[derive(Deserialize)]
                struct OllamaMsgOut {
                    content: String,
                }
                #[derive(Deserialize)]
                struct OllamaChatOut {
                    message: Option<OllamaMsgOut>,
                    prompt_eval_count: Option<u32>,
                    eval_count: Option<u32>,
                }

                let chat_out = resp
                    .json::<OllamaChatOut>()
                    .await
                    .map_err(|e| format!("Error deserializando respuesta Ollama: {}", e))?;

                let content = chat_out
                    .message
                    .map(|m| m.content)
                    .unwrap_or_else(|| "Sin respuesta de texto del modelo.".to_string());

                Ok(AiResponse {
                    content,
                    model_used: config.model_name.clone(),
                    provider_used: AiProvider::Ollama,
                    prompt_tokens: chat_out.prompt_eval_count.unwrap_or(0),
                    completion_tokens: chat_out.eval_count.unwrap_or(0),
                    is_mock_fallback: false,
                    generated_prompt: full_user_msg,
                })
            }
            AiProvider::OpenAiCompatible => {
                let chat_url = format!("{}/chat/completions", config.endpoint_url.trim_end_matches('/'));

                #[derive(Serialize)]
                struct Message {
                    role: String,
                    content: String,
                }
                #[derive(Serialize)]
                struct OpenAiChatReq {
                    model: String,
                    messages: Vec<Message>,
                    temperature: f64,
                }

                let req_body = OpenAiChatReq {
                    model: config.model_name.clone(),
                    messages: vec![
                        Message {
                            role: "system".to_string(),
                            content: system_msg.clone(),
                        },
                        Message {
                            role: "user".to_string(),
                            content: full_user_msg.clone(),
                        },
                    ],
                    temperature: config.temperature.unwrap_or(0.2),
                };

                let mut req = client.post(&chat_url).json(&req_body);
                if let Some(ref key) = config.api_key {
                    req = req.header("Authorization", format!("Bearer {}", key));
                }

                let resp = req
                    .send()
                    .await
                    .map_err(|e| format!("Error en petición HTTP OpenAI: {}", e))?;

                if !resp.status().is_success() {
                    return Err(format!("OpenAI API devolvió código de error HTTP {}", resp.status()));
                }

                #[derive(Deserialize)]
                struct ChoiceMsg {
                    content: String,
                }
                #[derive(Deserialize)]
                struct Choice {
                    message: Option<ChoiceMsg>,
                }
                #[derive(Deserialize)]
                struct Usage {
                    prompt_tokens: Option<u32>,
                    completion_tokens: Option<u32>,
                }
                #[derive(Deserialize)]
                struct OpenAiChatOut {
                    choices: Option<Vec<Choice>>,
                    usage: Option<Usage>,
                }

                let chat_out = resp
                    .json::<OpenAiChatOut>()
                    .await
                    .map_err(|e| format!("Error deserializando respuesta OpenAI: {}", e))?;

                let content = chat_out
                    .choices
                    .and_then(|mut c| if !c.is_empty() { c.remove(0).message } else { None })
                    .map(|m| m.content)
                    .unwrap_or_else(|| "Sin respuesta de texto.".to_string());

                let usage = chat_out.usage.unwrap_or(Usage {
                    prompt_tokens: Some(0),
                    completion_tokens: Some(0),
                });

                Ok(AiResponse {
                    content,
                    model_used: config.model_name.clone(),
                    provider_used: AiProvider::OpenAiCompatible,
                    prompt_tokens: usage.prompt_tokens.unwrap_or(0),
                    completion_tokens: usage.completion_tokens.unwrap_or(0),
                    is_mock_fallback: false,
                    generated_prompt: full_user_msg,
                })
            }
            AiProvider::Mock => unreachable!(),
        }
    }

    fn make_mock_response(
        user_prompt: &str,
        _system_msg: &str,
        full_user_msg: &str,
        config: &AiConfig,
    ) -> AiResponse {
        let content = format!(
            "### [Respuesta Simulada del Asistente SAAC v2.0]\n\n\
             He analizado tu consulta sobre la arquitectura del proyecto:\n\n\
             > \"{}\"\n\n\
             **Recomendación de Arquitectura:**\n\
             1. Mantén la separación estricta de capas respetando las abstracciones.\n\
             2. Si detectas un God Module o una Circular Dependency, aplica la inversión de dependencias recomendada.\n\n\
             *(Esta es una respuesta generada en modo simulado para pruebas)*",
            user_prompt
        );

        AiResponse {
            content,
            model_used: config.model_name.clone(),
            provider_used: AiProvider::Mock,
            prompt_tokens: 150,
            completion_tokens: 80,
            is_mock_fallback: true,
            generated_prompt: full_user_msg.to_string(),
        }
    }
}
