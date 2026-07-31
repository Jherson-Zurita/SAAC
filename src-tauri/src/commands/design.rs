use crate::engine::amg::NodeType;
use crate::engine::design::{
    compare_proposed_architecture as compare_design, export_proposed_architecture as export_design,
    ComparisonReport, DesignManager, ExportFormat, NodePosition, ProposedArchitecture,
    ProposedArchitectureSummary, ProposedNode,
};
use crate::engine::history::HistoryManager;

#[tauri::command]
pub fn create_proposed_architecture(
    project_path: String,
    name: String,
    description: Option<String>,
    based_on_run_id: Option<String>,
) -> Result<ProposedArchitecture, String> {
    let base = based_on_run_id
        .as_deref()
        .map(|run_id| {
            HistoryManager::load_amg_for_run(&project_path, run_id).ok_or_else(|| {
                format!(
                    "No se encontró el AMG completo de la corrida '{}'. Puede haber sido purgado.",
                    run_id
                )
            })
        })
        .transpose()?;
    DesignManager::create(&project_path, name, description, base.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_proposed_architectures(
    project_path: String,
) -> Result<Vec<ProposedArchitectureSummary>, String> {
    DesignManager::list(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_proposed_architecture(
    project_path: String,
    design_id: String,
) -> Result<ProposedArchitecture, String> {
    DesignManager::load(&project_path, &design_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_proposed_architecture(
    project_path: String,
    design_id: String,
    architecture: ProposedArchitecture,
) -> Result<ProposedArchitecture, String> {
    DesignManager::update(&project_path, &design_id, architecture).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_proposed_node(
    project_path: String,
    design_id: String,
    node_type: NodeType,
    label: String,
    position: NodePosition,
) -> Result<ProposedNode, String> {
    DesignManager::add_proposed_node(&project_path, &design_id, node_type, label, position)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_proposed_architecture(project_path: String, design_id: String) -> Result<(), String> {
    DesignManager::delete(&project_path, &design_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn compare_proposed_architecture(
    project_path: String,
    design_id: String,
    against_run_id: String,
) -> Result<ComparisonReport, String> {
    compare_design(&project_path, &design_id, &against_run_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_proposed_architecture(
    project_path: String,
    design_id: String,
    format: ExportFormat,
) -> Result<String, String> {
    export_design(&project_path, &design_id, format).map_err(|e| e.to_string())
}
