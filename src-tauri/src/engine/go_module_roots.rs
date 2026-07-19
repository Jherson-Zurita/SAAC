//! engine/go_module_roots.rs — Detecta el/los módulo(s) Go (`go.mod`) de un
//! proyecto, necesarios para resolver imports de paquetes Go
//! (`github.com/user/myproject/pkg/service`, o un module path corto tipo
//! `myproject/pkg/service`) contra los `module_id` (rutas de archivo) que
//! produce `parsers/go.py`.
//!
//! ## Por qué esto es distinto de Java
//!
//! En Java, el import nombra una CLASE (`com.example.UserRepository`),
//! que corresponde 1:1 a un archivo — la resolución (`java_source_roots.rs`)
//! solo necesita encontrar el sufijo de paquete como segmento de path
//! dentro del `module_id`, sin importar la ubicación absoluta de nada.
//!
//! En Go, el import nombra un PAQUETE (`github.com/user/myproject/pkg/
//! service`), que es un DIRECTORIO — todos los `.go` de ese directorio se
//! importan juntos. Además, el `module path` (`github.com/user/myproject`)
//! es un string LÓGICO declarado en `go.mod`, sin relación necesaria con
//! el nombre real de la carpeta en disco (a diferencia de Java, donde el
//! paquete SÍ tiene que coincidir con la carpeta). Por estos dos motivos:
//!   1. No alcanza con buscar un segmento de path — hace falta saber
//!      DÓNDE en el disco vive el `go.mod` (este archivo devuelve esa
//!      ubicación, `dir`, en la MISMA forma — absoluta o relativa, lo que
//!      sea — que usa `module_id`, para poder hacer match directo de
//!      prefijo en `aggregator.rs`).
//!   2. Un import resuelto genera aristas hacia TODOS los archivos del
//!      paquete/directorio, no hacia uno solo — ver
//!      `Aggregator::aggregate` en `aggregator.rs`, cuyo bucle de
//!      resolución soporta múltiples targets por dependencia exactamente
//!      por este motivo (Java y los imports relativos siguen resolviendo
//!      a 0 o 1 target, sin cambio de comportamiento).
//!
//! ## Alcance y limitaciones
//!
//! - Lee el `module <path>` de la primera línea no vacía que empieza con
//!   `module ` de cada `go.mod` encontrado (búsqueda en la raíz del
//!   proyecto y, si no hay ahí, en el primer nivel de subdirectorios —
//!   cubre un `go.mod` anidado en un monorepo simple).
//! - **Workspaces multi-módulo (`go.work`)**: si hay varios `go.mod`, se
//!   devuelven TODOS los detectados; `aggregator.rs` elige el de
//!   directorio más específico (prefijo más largo) para cada archivo.
//!   Esto funciona para el caso común, pero no replica reglas de
//!   precedencia/`replace` que pueda declarar un `go.work` real.
//! - Directivas `replace`/`require` de `go.mod` NO se leen — solo
//!   interesa el `module path` propio, para reconocer imports INTERNOS.
//! - Sin ningún `go.mod` encontrado, devuelve una lista vacía — a
//!   diferencia de Java, no existe una convención de fallback razonable
//!   sin conocer el module path (no hay equivalente a `src/main/java`
//!   estándar en Go).

use std::fs;
use std::path::Path;

/// Un módulo Go detectado: su `module path` lógico (de `go.mod`) y la
/// ubicación en disco de ese `go.mod`, en la misma forma (absoluta o
/// relativa) que usa `module_id` — ver docstring del archivo.
#[derive(Debug, Clone)]
pub struct GoModuleInfo {
    pub module_path: String,
    pub dir: String,
}

/// Detecta los módulos Go (`go.mod`) del proyecto, buscando en la raíz y
/// el primer nivel de subdirectorios. Lista vacía si no hay ningún
/// `go.mod` — proyectos sin Go no pagan costo funcional por esto (el
/// índice específico de Go en el agregador simplemente queda vacío).
pub fn detect_go_modules(project_root: &Path) -> Vec<GoModuleInfo> {
    let mut modules = Vec::new();

    for go_mod_path in find_all_files(project_root, "go.mod", 1) {
        let Ok(content) = fs::read_to_string(&go_mod_path) else {
            continue;
        };
        let Some(module_path) = extract_module_path(&content) else {
            continue;
        };
        let Some(dir) = go_mod_path.parent() else {
            continue;
        };

        modules.push(GoModuleInfo {
            module_path,
            dir: dir.to_string_lossy().replace('\\', "/"),
        });
    }

    modules
}

/// Extrae el module path de la directiva `module <path>` de un `go.mod`
/// — la primera línea no vacía (tras trim) que empieza con `module `.
fn extract_module_path(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("module ") {
            let module_path = rest.trim().trim_matches('"').to_string();
            if !module_path.is_empty() {
                return Some(module_path);
            }
        }
    }
    None
}

/// Busca TODAS las ocurrencias de un archivo por nombre exacto empezando
/// en `root`, descendiendo hasta `max_depth` niveles (0 = solo la raíz
/// misma) — a diferencia de `find_file` en `java_source_roots.rs`
/// (primera coincidencia), interesan TODAS porque puede haber varios
/// `go.mod` (submódulos / workspace).
fn find_all_files(root: &Path, filename: &str, max_depth: usize) -> Vec<std::path::PathBuf> {
    let mut found = Vec::new();

    let direct = root.join(filename);
    if direct.is_file() {
        found.push(direct);
    }

    if max_depth == 0 {
        return found;
    }

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                found.extend(find_all_files(&path, filename, max_depth - 1));
            }
        }
    }

    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_simple_module_path() {
        let content = "module github.com/user/myproject\n\ngo 1.22\n";
        assert_eq!(
            extract_module_path(content),
            Some("github.com/user/myproject".to_string())
        );
    }

    #[test]
    fn extracts_short_module_path() {
        let content = "module myproject\n\ngo 1.22\n";
        assert_eq!(extract_module_path(content), Some("myproject".to_string()));
    }

    #[test]
    fn ignores_leading_blank_lines_and_comments() {
        let content = "\n// comentario\nmodule github.com/user/myproject\n";
        assert_eq!(
            extract_module_path(content),
            Some("github.com/user/myproject".to_string())
        );
    }

    #[test]
    fn none_without_module_directive() {
        assert_eq!(extract_module_path("go 1.22\n"), None);
    }

    #[test]
    fn detect_returns_empty_without_go_mod() {
        let tmp = std::env::temp_dir().join(format!("saac_go_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&tmp);
        let modules = detect_go_modules(&tmp);
        assert!(modules.is_empty());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn detect_finds_module_and_dir() {
        let tmp = std::env::temp_dir().join(format!("saac_go_test2_{}", std::process::id()));
        let _ = fs::create_dir_all(&tmp);
        fs::write(tmp.join("go.mod"), "module github.com/user/myproject\n\ngo 1.22\n").unwrap();
        let modules = detect_go_modules(&tmp);
        assert_eq!(modules.len(), 1);
        assert_eq!(modules[0].module_path, "github.com/user/myproject");
        assert!(modules[0].dir.replace('\\', "/").ends_with(&tmp.file_name().unwrap().to_string_lossy().replace('\\', "/")));
        let _ = fs::remove_dir_all(&tmp);
    }
}
