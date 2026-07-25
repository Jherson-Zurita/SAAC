//! annotations.rs — Gestor de Anotaciones, Registros de Decisiones Arquitectónicas (ADRs),
//! Riesgos y Antipatrones Ignorados persistidos en `.saac/annotations.json`.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: String,
    pub target_id: String,
    pub target_type: String, // "module" | "class" | "function" | "c4_node"
    pub title: String,
    pub content: String,
    pub author: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Adr {
    pub id: String,
    pub number: usize,
    pub title: String,
    pub status: String, // "Proposed" | "Accepted" | "Rejected" | "Deprecated" | "Superseded"
    pub context: String,
    pub decision: String,
    pub consequences: String,
    pub date: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredAntipattern {
    pub antipattern_id: String,
    pub ignored_at: String,
    pub justification: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Risk {
    pub id: String,
    pub title: String,
    pub severity: String, // "Low" | "Medium" | "High" | "Critical"
    pub description: String,
    pub mitigation: String,
    pub affected_module_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAnnotations {
    pub annotations: Vec<Annotation>,
    pub adrs: Vec<Adr>,
    pub ignored_antipatterns: Vec<IgnoredAntipattern>,
    pub risks: Vec<Risk>,
}

pub struct AnnotationsManager;

impl AnnotationsManager {
    /// Carga las anotaciones desde `.saac/annotations.json`.
    pub fn load_annotations(project_path: &str) -> ProjectAnnotations {
        let path = Path::new(project_path).join(".saac").join("annotations.json");
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(data) = serde_json::from_str::<ProjectAnnotations>(&content) {
                    return data;
                }
            }
        }
        ProjectAnnotations::default()
    }

    /// Guarda las anotaciones en `.saac/annotations.json`.
    pub fn save_annotations(project_path: &str, data: &ProjectAnnotations) -> Result<(), String> {
        let saac_dir = Path::new(project_path).join(".saac");
        if !saac_dir.exists() {
            fs::create_dir_all(&saac_dir).map_err(|e| e.to_string())?;
        }
        let file_path = saac_dir.join("annotations.json");
        let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Añade o actualiza una anotación.
    pub fn add_annotation(project_path: &str, annotation: Annotation) -> Result<ProjectAnnotations, String> {
        let mut data = Self::load_annotations(project_path);
        data.annotations.retain(|a| a.id != annotation.id);
        data.annotations.push(annotation);
        Self::save_annotations(project_path, &data)?;
        Ok(data)
    }

    /// Añade o actualiza un ADR.
    pub fn add_adr(project_path: &str, adr: Adr) -> Result<ProjectAnnotations, String> {
        let mut data = Self::load_annotations(project_path);
        data.adrs.retain(|a| a.id != adr.id);
        data.adrs.push(adr);
        Self::save_annotations(project_path, &data)?;
        Ok(data)
    }

    /// Marca un antipatrón como ignorado con justificación.
    pub fn ignore_antipattern(
        project_path: &str,
        antipattern_id: &str,
        justification: &str,
        author: &str,
    ) -> Result<ProjectAnnotations, String> {
        let mut data = Self::load_annotations(project_path);
        data.ignored_antipatterns.retain(|i| i.antipattern_id != antipattern_id);
        data.ignored_antipatterns.push(IgnoredAntipattern {
            antipattern_id: antipattern_id.to_string(),
            ignored_at: chrono::Utc::now().to_rfc3339(),
            justification: justification.to_string(),
            author: author.to_string(),
        });
        Self::save_annotations(project_path, &data)?;
        Ok(data)
    }

    /// Añade o actualiza un riesgo documentado.
    pub fn add_risk(project_path: &str, risk: Risk) -> Result<ProjectAnnotations, String> {
        let mut data = Self::load_annotations(project_path);
        data.risks.retain(|r| r.id != risk.id);
        data.risks.push(risk);
        Self::save_annotations(project_path, &data)?;
        Ok(data)
    }
}
