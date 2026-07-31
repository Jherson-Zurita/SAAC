//! console.rs — Inspector de logs y terminal/consola interactiva de comandos SAAC (`saac> `).

use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub level: String, // "info" | "warn" | "error" | "debug"
    pub timestamp: String,
    pub target: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleCommandOutput {
    pub command: String,
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

pub struct ConsoleManager;

impl ConsoleManager {
    /// Parsea y ejecuta un comando interno de la consola SAAC (`saac> `).
    pub fn execute_command(input: &str, project_path: Option<&str>) -> ConsoleCommandOutput {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return ConsoleCommandOutput {
                command: "".to_string(),
                success: true,
                message: "No command provided.".to_string(),
                data: None,
            };
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        let cmd = parts[0].to_lowercase();
        let args = &parts[1..];

        match cmd.as_str() {
            "help" => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: true,
                message: [
                    "Available SAAC Console Commands:",
                    "  help                        - Show this help text",
                    "  clear                       - Clear console output",
                    "  analyze [path]              - Trigger project analysis",
                    "  cancel                      - Cancel running analysis",
                    "  ai status                   - Check local AI provider status",
                    "  ai ask <prompt>             - Send a prompt to the AI provider",
                    "  ignore add <pattern>        - Append pattern to .saacignore",
                    "  rules check                 - Evaluate architectural rules",
                    "  history                     - List past analysis runs",
                    "  status                      - Display current project status summary",
                ]
                .join("\n"),
                data: None,
            },

            "clear" => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: true,
                message: "Console cleared.".to_string(),
                data: Some(serde_json::json!({ "action": "clear" })),
            },

            "analyze" => {
                let target = args.first().copied().or(project_path).unwrap_or("");
                ConsoleCommandOutput {
                    command: trimmed.to_string(),
                    success: true,
                    message: format!("Analysis triggered for path: '{}'", target),
                    data: Some(serde_json::json!({ "action": "analyze", "path": target })),
                }
            }

            "cancel" => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: true,
                message: "Cancellation request sent.".to_string(),
                data: Some(serde_json::json!({ "action": "cancel" })),
            },

            "ai" => {
                if args.first().copied() == Some("status") {
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: true,
                        message: "Checking AI status...".to_string(),
                        data: Some(serde_json::json!({ "action": "ai_status" })),
                    }
                } else if args.first().copied() == Some("ask") && args.len() > 1 {
                    let prompt = args[1..].join(" ");
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: true,
                        message: format!("Sending prompt to AI: '{}'", prompt),
                        data: Some(serde_json::json!({ "action": "ai_ask", "prompt": prompt })),
                    }
                } else {
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: false,
                        message: "Usage: ai status | ai ask <prompt>".to_string(),
                        data: None,
                    }
                }
            }

            "ignore" => {
                if args.first().copied() == Some("add") && args.len() > 1 {
                    let pattern = args[1..].join(" ");
                    if let Some(p) = project_path {
                        let saacignore_path = Path::new(p).join(".saacignore");
                        let file = OpenOptions::new()
                            .create(true)
                            .append(true)
                            .open(saacignore_path);
                        match file {
                            Ok(mut f) => {
                                if let Err(e) = writeln!(f, "{}", pattern) {
                                    return ConsoleCommandOutput {
                                        command: trimmed.to_string(),
                                        success: false,
                                        message: format!("Failed to write to .saacignore: {}", e),
                                        data: None,
                                    };
                                }
                                ConsoleCommandOutput {
                                    command: trimmed.to_string(),
                                    success: true,
                                    message: format!("Added pattern '{}' to .saacignore", pattern),
                                    data: Some(serde_json::json!({ "pattern": pattern })),
                                }
                            }
                            Err(e) => ConsoleCommandOutput {
                                command: trimmed.to_string(),
                                success: false,
                                message: format!("Could not open .saacignore: {}", e),
                                data: None,
                            },
                        }
                    } else {
                        ConsoleCommandOutput {
                            command: trimmed.to_string(),
                            success: false,
                            message: "No project path provided to add ignore pattern.".to_string(),
                            data: None,
                        }
                    }
                } else {
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: false,
                        message: "Usage: ignore add <pattern>".to_string(),
                        data: None,
                    }
                }
            }

            "rules" => {
                if args.first().copied() == Some("check") {
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: true,
                        message: "Executing architectural rules check...".to_string(),
                        data: Some(serde_json::json!({ "action": "rules_check" })),
                    }
                } else {
                    ConsoleCommandOutput {
                        command: trimmed.to_string(),
                        success: false,
                        message: "Usage: rules check".to_string(),
                        data: None,
                    }
                }
            }

            "history" => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: true,
                message: "Fetching analysis history...".to_string(),
                data: Some(serde_json::json!({ "action": "history" })),
            },

            "status" => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: true,
                message: format!(
                    "SAAC Engine active. Active Project Path: '{}'",
                    project_path.unwrap_or("None")
                ),
                data: Some(serde_json::json!({ "projectPath": project_path })),
            },

            _ => ConsoleCommandOutput {
                command: trimmed.to_string(),
                success: false,
                message: format!(
                    "Unknown command: '{}'. Type 'help' for available commands.",
                    cmd
                ),
                data: None,
            },
        }
    }
}
