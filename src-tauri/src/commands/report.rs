// Exportación del informe de arquitectura (Markdown / PDF).
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

fn sanitize_file_stem(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '_' | ' ' | '.') { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c.is_whitespace());
    if trimmed.is_empty() { "informe-saac".to_string() } else { trimmed.chars().take(120).collect() }
}

/// Pide la ruta con el diálogo nativo y escribe el informe ya generado por el
/// frontend. El frontend no elige la ruta: solo el usuario, en el diálogo.
/// Devuelve la ruta guardada, o `None` si el usuario canceló.
#[tauri::command]
pub async fn save_report(
    app: AppHandle,
    format: String,
    file_stem: String,
    contents: Vec<u8>,
) -> Result<Option<String>, String> {
    let (filter_name, extension) = match format.as_str() {
        "markdown" => ("Markdown", "md"),
        "pdf" => ("PDF", "pdf"),
        other => return Err(format!("Formato de informe no soportado: {}", other)),
    };
    let file_name = format!("{}.{}", sanitize_file_stem(&file_stem), extension);

    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Guardar informe de arquitectura")
            .set_file_name(&file_name)
            .add_filter(filter_name, &[extension])
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(picked) = picked else { return Ok(None) };
    let mut path = picked.into_path().map_err(|e| e.to_string())?;
    if !path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case(extension))
    {
        path.set_extension(extension);
    }

    tokio::fs::write(&path, contents)
        .await
        .map_err(|e| format!("No se pudo guardar el informe: {}", e))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::sanitize_file_stem;

    #[test]
    fn sanitizes_report_file_names() {
        assert_eq!(sanitize_file_stem("informe SAAC 2026-10-08"), "informe SAAC 2026-10-08");
        assert_eq!(sanitize_file_stem("../../etc/passwd"), "_.._etc_passwd");
        assert_eq!(sanitize_file_stem("  ..  "), "informe-saac");
    }
}
