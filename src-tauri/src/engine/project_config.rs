//! project_config.rs — Configuración específica por proyecto y gestión de ignorados (`.saacignore`).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub ignore_patterns: Vec<String>,
    pub ignore_extensions: Vec<String>,
    pub max_file_size_mb: f64,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            ignore_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/.venv/**".to_string(),
                "**/.git/**".to_string(),
                "**/dist/**".to_string(),
                "**/build/**".to_string(),
            ],
            ignore_extensions: vec![
                ".min.js".to_string(),
                ".min.css".to_string(),
                ".map".to_string(),
            ],
            max_file_size_mb: 1.0,
        }
    }
}

pub struct ProjectConfigManager;

impl ProjectConfigManager {
    /// Carga la configuración del proyecto desde `.saac/config.json`.
    /// Si el archivo no existe, retorna la configuración predeterminada.
    pub fn load_config(project_path: &str) -> ProjectConfig {
        let config_path = Path::new(project_path).join(".saac").join("config.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<ProjectConfig>(&content) {
                    return config;
                }
            }
        }
        ProjectConfig::default()
    }

    /// Guarda la configuración del proyecto en `.saac/config.json`.
    pub fn save_config(project_path: &str, config: &ProjectConfig) -> Result<(), String> {
        let saac_dir = Path::new(project_path).join(".saac");
        if !saac_dir.exists() {
            fs::create_dir_all(&saac_dir).map_err(|e| e.to_string())?;
        }
        let config_path = saac_dir.join("config.json");
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Lee las líneas no vacías ni comentadas del archivo `.saacignore` si existe.
    pub fn read_saacignore(project_path: &str) -> Vec<String> {
        let ignore_path = Path::new(project_path).join(".saacignore");
        if ignore_path.exists() {
            if let Ok(content) = fs::read_to_string(ignore_path) {
                return content
                    .lines()
                    .map(|l| l.trim().to_string())
                    .filter(|l| !l.is_empty() && !l.starts_with('#'))
                    .collect();
            }
        }
        Vec::new()
    }

    /// Obtiene la lista combinada de patrones de ignorado (`.saacignore` + `config.ignore_patterns`).
    pub fn get_effective_ignore_patterns(project_path: &str) -> Vec<String> {
        let mut patterns = Self::read_saacignore(project_path);
        let config = Self::load_config(project_path);
        for p in config.ignore_patterns {
            if !patterns.contains(&p) {
                patterns.push(p);
            }
        }
        patterns
    }
}
