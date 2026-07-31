//! global_config.rs — Gestor de Configuración Global de la aplicación SAAC persistido en AppData.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfig {
    pub ai_provider: String,      // "ollama" | "openai" | "mock"
    pub ai_endpoint: String,      // "http://localhost:11434"
    pub ai_default_model: String, // "qwen3:4b"
    pub max_worker_threads: usize,
    pub default_theme: String, // "dark" | "light" | "system"
    pub auto_check_ai: bool,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        Self {
            ai_provider: "ollama".to_string(),
            ai_endpoint: "http://localhost:11434".to_string(),
            ai_default_model: "qwen3:4b".to_string(),
            max_worker_threads: 4,
            default_theme: "dark".to_string(),
            auto_check_ai: true,
        }
    }
}

pub struct GlobalConfigManager;

impl GlobalConfigManager {
    /// Determina la ruta del archivo `global_config.json` en AppData o la carpeta home.
    fn get_global_config_path() -> PathBuf {
        if let Some(mut path) = std::env::var_os("APPDATA").map(PathBuf::from) {
            path.push("saac");
            path.push("global_config.json");
            return path;
        }
        if let Some(mut path) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
            path.push(".saac");
            path.push("global_config.json");
            return path;
        }
        PathBuf::from(".saac_global_config.json")
    }

    /// Carga la configuración global desde AppData / home.
    pub fn load_config() -> GlobalConfig {
        let path = Self::get_global_config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str::<GlobalConfig>(&content) {
                    return config;
                }
            }
        }
        GlobalConfig::default()
    }

    /// Guarda la configuración global en AppData / home.
    pub fn save_config(config: &GlobalConfig) -> Result<(), String> {
        let path = Self::get_global_config_path();
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}
