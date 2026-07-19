// Comandos de proyecto
#[tauri::command]
pub fn open_project(path: String) -> Result<String, String> {
    Ok(format!("Opened project at {}", path))
}
