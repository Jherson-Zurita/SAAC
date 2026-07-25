//! history.rs — Historial de Análisis, AnalysisRun y cálculo de versión / deltas de arquitectura (`AMGDelta`).

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use crate::engine::amg::ArchitectureModelGraph;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRunSummary {
    pub run_id: String,
    pub timestamp: String,
    pub total_files: usize,
    pub successful: usize,
    pub failed: usize,
    pub duration_ms: u64,
    pub module_count: usize,
    pub dependency_count: usize,
    pub antipattern_count: usize,
    pub fitness_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisHistory {
    pub runs: Vec<AnalysisRunSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AMGDelta {
    pub run_id_a: String,
    pub run_id_b: String,
    pub timestamp_a: String,
    pub timestamp_b: String,
    pub added_modules: Vec<String>,
    pub removed_modules: Vec<String>,
    pub modified_modules: Vec<String>,
    pub added_dependencies_count: usize,
    pub removed_dependencies_count: usize,
    pub metrics_diff: HashMap<String, f64>,
}

pub struct HistoryManager;

impl HistoryManager {
    /// Carga el historial de corridas desde `.saac/history.json`.
    pub fn load_history(project_path: &str) -> AnalysisHistory {
        let path = Path::new(project_path).join(".saac").join("history.json");
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(history) = serde_json::from_str::<AnalysisHistory>(&content) {
                    return history;
                }
            }
        }
        AnalysisHistory::default()
    }

    /// Guarda una corrida en el historial `.saac/history.json`.
    pub fn record_run(
        project_path: &str,
        run_id: &str,
        total_files: usize,
        successful: usize,
        failed: usize,
        duration_ms: u64,
        amg: &ArchitectureModelGraph,
        fitness_score: f64,
    ) -> Result<AnalysisHistory, String> {
        let mut history = Self::load_history(project_path);
        let summary = AnalysisRunSummary {
            run_id: run_id.to_string(),
            timestamp: amg.analyzed_at.clone(),
            total_files,
            successful,
            failed,
            duration_ms,
            module_count: amg.modules.len(),
            dependency_count: amg.dependencies.len(),
            antipattern_count: amg.antipatterns.len(),
            fitness_score,
        };

        history.runs.retain(|r| r.run_id != run_id);
        history.runs.push(summary);

        let saac_dir = Path::new(project_path).join(".saac");
        if !saac_dir.exists() {
            fs::create_dir_all(&saac_dir).map_err(|e| e.to_string())?;
        }
        let file_path = saac_dir.join("history.json");
        let content = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())?;

        Ok(history)
    }

    /// Calcula la diferencia arquitectónica (AMGDelta) entre dos AMGs (`amg_a` y `amg_b`).
    pub fn compute_delta(
        run_id_a: &str,
        amg_a: &ArchitectureModelGraph,
        run_id_b: &str,
        amg_b: &ArchitectureModelGraph,
    ) -> AMGDelta {
        let set_a: HashSet<String> = amg_a.modules.iter().map(|m| m.id.clone()).collect();
        let set_b: HashSet<String> = amg_b.modules.iter().map(|m| m.id.clone()).collect();

        let added_modules: Vec<String> = set_b.difference(&set_a).cloned().collect();
        let removed_modules: Vec<String> = set_a.difference(&set_b).cloned().collect();
        let common_modules: Vec<String> = set_a.intersection(&set_b).cloned().collect();

        let map_a: HashMap<String, u32> = amg_a.modules.iter().map(|m| (m.id.clone(), m.loc)).collect();
        let map_b: HashMap<String, u32> = amg_b.modules.iter().map(|m| (m.id.clone(), m.loc)).collect();

        let mut modified_modules = Vec::new();
        for id in common_modules {
            let loc_a = map_a.get(&id).cloned().unwrap_or(0);
            let loc_b = map_b.get(&id).cloned().unwrap_or(0);
            if loc_a != loc_b {
                modified_modules.push(id);
            }
        }

        let dep_set_a: HashSet<String> = amg_a
            .dependencies
            .iter()
            .map(|d| format!("{}->{}", d.source, d.target))
            .collect();
        let dep_set_b: HashSet<String> = amg_b
            .dependencies
            .iter()
            .map(|d| format!("{}->{}", d.source, d.target))
            .collect();

        let added_deps = dep_set_b.difference(&dep_set_a).count();
        let removed_deps = dep_set_a.difference(&dep_set_b).count();

        let mut metrics_diff = HashMap::new();
        metrics_diff.insert(
            "total_loc_diff".to_string(),
            amg_b.metrics.total_loc as f64 - amg_a.metrics.total_loc as f64,
        );
        metrics_diff.insert(
            "module_count_diff".to_string(),
            amg_b.modules.len() as f64 - amg_a.modules.len() as f64,
        );
        metrics_diff.insert(
            "antipattern_count_diff".to_string(),
            amg_b.antipatterns.len() as f64 - amg_a.antipatterns.len() as f64,
        );

        AMGDelta {
            run_id_a: run_id_a.to_string(),
            run_id_b: run_id_b.to_string(),
            timestamp_a: amg_a.analyzed_at.clone(),
            timestamp_b: amg_b.analyzed_at.clone(),
            added_modules,
            removed_modules,
            modified_modules,
            added_dependencies_count: added_deps,
            removed_dependencies_count: removed_deps,
            metrics_diff,
        }
    }
}
