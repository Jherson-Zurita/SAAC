//! pre_frontend.rs — Comandos Tauri IPC para los 6 módulos pre-frontend (Configuración, Consola, Anotaciones, Reglas, Historial, Global).

use crate::engine::amg::{ArchitectureModelGraph, C4DiagramData};
use crate::engine::annotations::{Adr, Annotation, AnnotationsManager, ProjectAnnotations, Risk};
use crate::engine::c4_generator::C4Generator;
use crate::engine::console::{ConsoleCommandOutput, ConsoleManager};
use crate::engine::global_config::{GlobalConfig, GlobalConfigManager};
use crate::engine::history::{AMGDelta, AnalysisHistory, HistoryManager};
use crate::engine::project_config::{ProjectConfig, ProjectConfigManager};
use crate::engine::rules::{FitnessEvaluationResult, RuleConfig, RulesEngine};

// ── Comandos Módulo 1: Project Config & Ignorados ──

#[tauri::command]
pub fn get_project_config(project_path: String) -> ProjectConfig {
    ProjectConfigManager::load_config(&project_path)
}

#[tauri::command]
pub fn update_project_config(project_path: String, config: ProjectConfig) -> Result<ProjectConfig, String> {
    ProjectConfigManager::save_config(&project_path, &config)?;
    Ok(config)
}

// ── Comandos Módulo 2: Consola SAAC ──

#[tauri::command]
pub fn execute_console_command(input: String, project_path: Option<String>) -> ConsoleCommandOutput {
    ConsoleManager::execute_command(&input, project_path.as_deref())
}

// ── Comandos Módulo 3: Anotaciones, ADRs, Antipatrones Ignorados ──

#[tauri::command]
pub fn load_project_annotations(project_path: String) -> ProjectAnnotations {
    AnnotationsManager::load_annotations(&project_path)
}

#[tauri::command]
pub fn add_annotation(project_path: String, annotation: Annotation) -> Result<ProjectAnnotations, String> {
    AnnotationsManager::add_annotation(&project_path, annotation)
}

#[tauri::command]
pub fn add_adr(project_path: String, adr: Adr) -> Result<ProjectAnnotations, String> {
    AnnotationsManager::add_adr(&project_path, adr)
}

#[tauri::command]
pub fn ignore_antipattern(
    project_path: String,
    antipattern_id: String,
    justification: String,
    author: String,
) -> Result<ProjectAnnotations, String> {
    AnnotationsManager::ignore_antipattern(&project_path, &antipattern_id, &justification, &author)
}

#[tauri::command]
pub fn add_risk(project_path: String, risk: Risk) -> Result<ProjectAnnotations, String> {
    AnnotationsManager::add_risk(&project_path, risk)
}

// ── Comandos Módulo 4: Motor de Reglas (Fitness Score Configurable) ──

#[tauri::command]
pub fn get_rules_config(project_path: String) -> RuleConfig {
    RulesEngine::load_rules_config(&project_path)
}

#[tauri::command]
pub fn update_rules_config(project_path: String, config: RuleConfig) -> Result<RuleConfig, String> {
    RulesEngine::save_rules_config(&project_path, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn evaluate_fitness_rules(
    project_path: String,
    amg: Option<ArchitectureModelGraph>,
) -> Result<FitnessEvaluationResult, String> {
    let rules_config = RulesEngine::load_rules_config(&project_path);
    if let Some(graph) = amg {
        Ok(RulesEngine::evaluate(&graph, &rules_config))
    } else {
        Err("No ArchitectureModelGraph provided for evaluation.".to_string())
    }
}

// ── Comandos Módulo 5: Historial y Versionado AMG ──

#[tauri::command]
pub fn get_analysis_history(project_path: String) -> AnalysisHistory {
    HistoryManager::load_history(&project_path)
}

#[tauri::command]
pub fn compare_analysis_runs(
    project_path: String,
    run_id_a: String,
    run_id_b: String,
) -> Result<AMGDelta, String> {
    // Los AMGs completos de cada corrida se leen desde disco
    // (`.saac/runs/<run_id>.json`, persistidos por `HistoryManager::record_run`
    // en el momento de cada análisis) en vez de recibirse como parámetro del
    // comando. Antes, este comando exigía que el frontend tuviera ambos AMGs
    // completos ya cargados en memoria para poder compararlos — lo cual solo
    // funcionaba para la corrida más reciente (la que el frontend acababa de
    // recibir de `analyze_project`), no para comparar dos corridas
    // arbitrarias del historial, que es el caso de uso real de esta función.
    let amg_a = HistoryManager::load_amg_for_run(&project_path, &run_id_a)
        .ok_or_else(|| format!("No se encontró el AMG completo de la corrida '{}'. Puede haber sido purgado.", run_id_a))?;
    let amg_b = HistoryManager::load_amg_for_run(&project_path, &run_id_b)
        .ok_or_else(|| format!("No se encontró el AMG completo de la corrida '{}'. Puede haber sido purgado.", run_id_b))?;

    Ok(HistoryManager::compute_delta(&run_id_a, &amg_a, &run_id_b, &amg_b))
}

// ── Comandos Módulo 6: Configuración Global ──

#[tauri::command]
pub fn get_global_config() -> GlobalConfig {
    GlobalConfigManager::load_config()
}

#[tauri::command]
pub fn update_global_config(config: GlobalConfig) -> Result<GlobalConfig, String> {
    GlobalConfigManager::save_config(&config)?;
    Ok(config)
}

// ── Comando Adicional Nivel 4 (Drill-Down C4 Código) ──

#[tauri::command]
pub fn get_module_code_diagram(module_id: String, amg: ArchitectureModelGraph) -> Result<C4DiagramData, String> {
    let module = amg
        .modules
        .iter()
        .find(|m| m.id == module_id)
        .ok_or_else(|| format!("Module '{}' not found in AMG", module_id))?;
    Ok(C4Generator::generate_module_code_diagram(module))
}