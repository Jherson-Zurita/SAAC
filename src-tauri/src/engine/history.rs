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
    /// Directorio donde se persiste el AMG completo de cada corrida,
    /// un archivo JSON por `run_id` (`.saac/runs/<run_id>.json`).
    ///
    /// Se guarda SEPARADO de `history.json` (que solo contiene
    /// `AnalysisRunSummary`, datos agregados livianos) para que listar el
    /// historial completo — algo que la UI hace con frecuencia, ej. al
    /// abrir la pestaña "Historial de Análisis" — no requiera cargar ni
    /// deserializar potencialmente cientos de AMGs completos de una vez.
    /// Solo se lee el AMG de una corrida puntual cuando el usuario
    /// explícitamente pide compararla (`compare_analysis_runs`).
    fn runs_dir(project_path: &str) -> std::path::PathBuf {
        Path::new(project_path).join(".saac").join("runs")
    }

    /// Persiste el AMG completo de una corrida específica.
    ///
    /// Llamado desde `record_run` (ver más abajo) para que ambas
    /// escrituras — el resumen en `history.json` y el AMG completo en
    /// `.saac/runs/<run_id>.json` — ocurran juntas y con el mismo
    /// `run_id`, evitando que queden desincronizadas.
    fn save_amg_for_run(
        project_path: &str,
        run_id: &str,
        amg: &ArchitectureModelGraph,
    ) -> Result<(), String> {
        let runs_dir = Self::runs_dir(project_path);
        if !runs_dir.exists() {
            fs::create_dir_all(&runs_dir).map_err(|e| e.to_string())?;
        }
        let file_path = runs_dir.join(format!("{}.json", run_id));
        let content = serde_json::to_string(amg).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Carga el AMG completo de una corrida específica por su `run_id`.
    ///
    /// Devuelve `None` si la corrida no existe o su archivo fue purgado
    /// (ver política de purga en `.saac/config.yaml`, fuera del alcance de
    /// este módulo) — el llamador (`compare_analysis_runs`) debe manejar
    /// ese caso devolviendo un error claro al frontend, no un pánico.
    pub fn load_amg_for_run(project_path: &str, run_id: &str) -> Option<ArchitectureModelGraph> {
        let file_path = Self::runs_dir(project_path).join(format!("{}.json", run_id));
        let content = fs::read_to_string(file_path).ok()?;
        serde_json::from_str(&content).ok()
    }

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

    /// Guarda una corrida en el historial `.saac/history.json` Y persiste
    /// su AMG completo en `.saac/runs/<run_id>.json` (ver `save_amg_for_run`).
    ///
    /// Si la escritura del AMG completo falla (ej. disco lleno), la corrida
    /// igual queda registrada en `history.json` — se prioriza no perder el
    /// resumen liviano aunque el detalle completo no se haya podido
    /// persistir; el error se propaga igual para que el llamador lo loguee.
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

        // Persistir el AMG completo de esta corrida. Se hace DESPUÉS de
        // escribir history.json a propósito: si esto falla, el resumen
        // liviano ya quedó guardado (degradación aceptable — la corrida
        // sigue apareciendo en el historial, solo no será comparable en
        // detalle), en vez de perder el registro completo por un fallo
        // aislado al guardar el AMG.
        Self::save_amg_for_run(project_path, run_id, amg)?;

        // Generar archivo JSON resumen físico en .saac/analysis-summary.json para depuración
        Self::save_analysis_summary(project_path, total_files, successful, failed, duration_ms, amg, fitness_score);

        Ok(history)
    }

    /// Guarda un archivo resumen detallado en `.saac/analysis-summary.json`
    fn save_analysis_summary(
        project_path: &str,
        total_files: usize,
        successful: usize,
        failed: usize,
        duration_ms: u64,
        amg: &ArchitectureModelGraph,
        fitness_score: f64,
    ) {
        let saac_dir = Path::new(project_path).join(".saac");
        let _ = fs::create_dir_all(&saac_dir);
        let summary_file = saac_dir.join("analysis-summary.json");

        let mut diagrams_info = Vec::new();
        diagrams_info.push(serde_json::json!({
            "diagram": "C4 Level 1 (Context)",
            "nodes": amg.c4_models.context_diagram.nodes.len(),
            "edges": amg.c4_models.context_diagram.edges.len(),
        }));
        diagrams_info.push(serde_json::json!({
            "diagram": "C4 Level 2 (Container)",
            "nodes": amg.c4_models.container_diagram.nodes.len(),
            "edges": amg.c4_models.container_diagram.edges.len(),
        }));
        for (key, diag) in &amg.c4_models.component_diagrams {
            diagrams_info.push(serde_json::json!({
                "diagram": key,
                "nodes": diag.nodes.len(),
                "edges": diag.edges.len(),
            }));
        }

        let summary = serde_json::json!({
            "timestamp": amg.analyzed_at,
            "project_path": project_path,
            "project_name": amg.project_name,
            "saac_version": "2.0.0",
            "overview": {
                "total_files": total_files,
                "successful_files": successful,
                "failed_files": failed,
                "duration_ms": duration_ms,
            },
            "architecture": {
                "detected_type": amg.detected_type,
                "detected_style": amg.detected_style,
                "style_confidence": amg.style_confidence,
                "module_count": amg.modules.len(),
                "dependency_count": amg.dependencies.len(),
                "container_count": amg.containers.len(),
                "external_system_count": amg.external_systems.len(),
                "actor_count": amg.actors.len(),
                "antipattern_count": amg.antipatterns.len(),
                "fitness_score": fitness_score,
            },
            "metrics": amg.metrics,
            "antipatterns": amg.antipatterns,
            "diagrams_diagnostics": diagrams_info,
        });

        if let Ok(json_str) = serde_json::to_string_pretty(&summary) {
            let _ = fs::write(summary_file, json_str);
        }
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

        let map_a: HashMap<String, u32> = amg_a
            .modules
            .iter()
            .map(|m| (m.id.clone(), m.loc))
            .collect();
        let map_b: HashMap<String, u32> = amg_b
            .modules
            .iter()
            .map(|m| (m.id.clone(), m.loc))
            .collect();

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
