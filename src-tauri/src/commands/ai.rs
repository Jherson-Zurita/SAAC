// Comandos de IA / Ollama
#[tauri::command]
pub fn ask_ai(prompt: String) -> Result<String, String> {
    Ok(format!("AI Response to: {}", prompt))
}
