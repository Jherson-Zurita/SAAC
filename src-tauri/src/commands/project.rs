// Comandos de proyecto
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn open_project(path: String) -> Result<String, String> {
    Ok(format!("Opened project at {}", path))
}

/// Extensiones que los workers analizan; el id de módulo es la ruta sin ella.
const SOURCE_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "py", "pyi", "java", "kt", "kts", "cs", "swift", "go", "rs",
];
const MAX_SOURCE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleSource {
    pub file_path: String,
    pub relative_path: String,
    pub extension: String,
    pub content: String,
    pub size_bytes: u64,
    pub line_count: usize,
    pub modified_at: Option<String>,
}

/// Ubica el archivo de un módulo del AMG, exigiendo que esté dentro del proyecto
/// (tras resolver symlinks y `..`) y que tenga una extensión de código soportada.
fn resolve_module_file(project_path: &str, module_id: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = fs::canonicalize(project_path)
        .map_err(|e| format!("No se pudo acceder al proyecto '{}': {}", project_path, e))?;

    let base = Path::new(module_id);
    let base = if base.is_absolute() { base.to_path_buf() } else { root.join(base) };

    let has_source_ext = base
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| SOURCE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()));

    let mut candidates: Vec<PathBuf> = SOURCE_EXTENSIONS
        .iter()
        .map(|ext| PathBuf::from(format!("{}.{}", base.to_string_lossy(), ext)))
        .collect();
    if has_source_ext {
        candidates.insert(0, base);
    }

    for candidate in candidates {
        let Ok(resolved) = fs::canonicalize(&candidate) else { continue };
        if !resolved.is_file() {
            continue;
        }
        let ext_ok = resolved
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| SOURCE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()));
        if !ext_ok {
            continue;
        }
        if !resolved.starts_with(&root) {
            return Err("El archivo del módulo está fuera del proyecto abierto.".to_string());
        }
        return Ok((root, resolved));
    }

    Err(format!(
        "No se encontró el archivo fuente de '{}'. Puede haberse movido o eliminado desde el último análisis.",
        module_id
    ))
}

fn display_path(path: &Path) -> String {
    let s = path.to_string_lossy();
    s.strip_prefix(r"\\?\").unwrap_or(&s).replace('\\', "/")
}

fn read_module_source_sync(project_path: &str, module_id: &str) -> Result<ModuleSource, String> {
    let (root, file) = resolve_module_file(project_path, module_id)?;

    let metadata = fs::metadata(&file).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_SOURCE_BYTES {
        return Err(format!(
            "El archivo pesa {:.1} MB; el visor admite hasta {} MB.",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_SOURCE_BYTES / (1024 * 1024)
        ));
    }

    let bytes = fs::read(&file).map_err(|e| format!("No se pudo leer el archivo: {}", e))?;
    if bytes.contains(&0) {
        return Err("El archivo parece binario y no se puede mostrar.".to_string());
    }
    let content = String::from_utf8_lossy(&bytes).into_owned();

    let relative_path = file
        .strip_prefix(&root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| display_path(&file));

    Ok(ModuleSource {
        file_path: display_path(&file),
        relative_path,
        extension: file
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase(),
        line_count: content.lines().count(),
        size_bytes: metadata.len(),
        modified_at: metadata
            .modified()
            .ok()
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()),
        content,
    })
}

/// Lee el código fuente real de un módulo del AMG (solo archivos dentro del proyecto).
#[tauri::command]
pub async fn read_module_source(project_path: String, module_id: String) -> Result<ModuleSource, String> {
    tauri::async_runtime::spawn_blocking(move || read_module_source_sync(&project_path, &module_id))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_module_by_id_without_extension() {
        let dir = tempfile::TempDir::new().unwrap();
        let file = dir.path().join("src").join("app.ts");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "export const a = 1;\nexport const b = 2;\n").unwrap();

        let root = dir.path().to_string_lossy().to_string();
        let id = format!("{}/src/app", root.replace('\\', "/"));
        let source = read_module_source_sync(&root, &id).unwrap();

        assert_eq!(source.relative_path, "src/app.ts");
        assert_eq!(source.extension, "ts");
        assert_eq!(source.line_count, 2);
    }

    #[test]
    fn rejects_files_outside_project_or_unsupported() {
        let outer = tempfile::TempDir::new().unwrap();
        let project = outer.path().join("project");
        fs::create_dir_all(&project).unwrap();
        fs::write(outer.path().join("secret.py"), "TOKEN = 1").unwrap();
        fs::write(project.join("notes.txt"), "hola").unwrap();

        let root = project.to_string_lossy().to_string();
        assert!(read_module_source_sync(&root, "../secret").is_err());
        assert!(read_module_source_sync(&root, &outer.path().join("secret").to_string_lossy()).is_err());
        assert!(read_module_source_sync(&root, "notes").is_err());
    }
}
