//! engine/rust_crate_roots.rs — Detecta el/los crate(s) Rust (`Cargo.toml`
//! con tabla `[package]`) de un proyecto, necesarios para resolver
//! imports `use crate::...` / `use <nombre_del_crate>::...` contra los
//! `module_id` (rutas de archivo) que produce `parsers/rust.py`.
//!
//! ## Por qué esto es necesario
//!
//! Un import Rust nombra un ÍTEM dentro del árbol de módulos
//! (`crate::engine::amg::Module`), casi siempre correspondiendo a UN
//! archivo (`src/engine/amg.rs`) — más parecido a Java que a Go en ese
//! sentido (ver `go_module_roots.rs` para el caso de paquetes-directorio).
//! Pero, igual que Go, el prefijo `crate::` (o el nombre del propio crate)
//! es lógico, no derivable de la ruta en disco sin saber DÓNDE está la
//! raíz `src/` de ESE crate — de ahí que, igual que
//! `GoModuleInfo`, `RustCrateInfo` devuelva `dir` en la misma forma
//! (absoluta o relativa) que usa `module_id`, para poder hacer match de
//! prefijo directo en `aggregator.rs`.
//!
//! ## Alcance y limitaciones
//!
//! - Cubre la convención moderna sin `mod.rs` (`src/foo/bar.rs`) Y la
//!   antigua con `mod.rs` (`src/foo/bar/mod.rs`, la que usa este mismo
//!   proyecto — ver `engine/mod.rs`); ambas se prueban al resolver.
//! - El nombre del crate se lee de `[package] name = "..."` en
//!   `Cargo.toml` con búsqueda de texto simple (no TOML real — mismo
//!   criterio pragmático que la lectura de `build.gradle` en
//!   `java_source_roots.rs`: cubre la declaración literal común, no
//!   expresiones dinámicas). Rust normaliza guiones a guion bajo al usar
//!   el nombre como identificador en código (`my-crate` en Cargo.toml ->
//!   `my_crate` en `use my_crate::...`) — se aplica esa misma
//!   normalización aquí.
//! - Workspaces (`[workspace] members = [...]`) se manejan encontrando
//!   TODOS los `Cargo.toml` con tabla `[package]` del proyecto (búsqueda
//!   acotada a 3 niveles de profundidad, saltando `target/`/
//!   `node_modules/`/`.git/`), sin parsear la lista `members` — más
//!   simple y funciona igual de bien para resolución de imports. Un
//!   `Cargo.toml` de workspace RAÍZ sin tabla `[package]` propia
//!   (workspace virtual) correctamente no cuenta como crate.
//! - `self::` / `super::` (rutas relativas al árbol de módulos `mod`, no
//!   al filesystem) NO se resuelven — necesitarían rastrear la posición
//!   de cada archivo dentro del árbol de declaraciones `mod`, no solo su
//!   ubicación en disco. Caen al fallback por basename en `aggregator.rs`.

use std::fs;
use std::path::Path;

/// Un crate Rust detectado: su nombre normalizado (tal como aparece en
/// `use <nombre>::...`) y la ubicación en disco de su `Cargo.toml`, en la
/// misma forma (absoluta o relativa) que usa `module_id`.
#[derive(Debug, Clone)]
pub struct RustCrateInfo {
    pub crate_name: String,
    pub dir: String,
}

/// Detecta todos los crates Rust (`Cargo.toml` con tabla `[package]`) del
/// proyecto, buscando en la raíz y hasta 3 niveles de subdirectorios
/// (cubre workspaces simples tipo `crates/foo/Cargo.toml`).
pub fn detect_rust_crates(project_root: &Path) -> Vec<RustCrateInfo> {
    let mut crates = Vec::new();

    for cargo_toml_path in find_all_files(project_root, "Cargo.toml", 3) {
        let Ok(content) = fs::read_to_string(&cargo_toml_path) else {
            continue;
        };
        let Some(name) = extract_package_name(&content) else {
            continue;
        };
        let Some(dir) = cargo_toml_path.parent() else {
            continue;
        };

        crates.push(RustCrateInfo {
            crate_name: name.replace('-', "_"),
            dir: dir.to_string_lossy().replace('\\', "/"),
        });
    }

    crates
}

/// Extrae `name = "..."` de la tabla `[package]` de un `Cargo.toml`:
/// primera línea `name = "..."` que aparece DESPUÉS del encabezado
/// `[package]` y ANTES de la siguiente sección `[...]`, para no
/// confundirla con un `name` de `[dependencies]` u otra tabla.
fn extract_package_name(content: &str) -> Option<String> {
    let mut in_package_section = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_package_section = trimmed == "[package]";
            continue;
        }
        if in_package_section {
            if let Some(rest) = trimmed.strip_prefix("name") {
                let rest = rest.trim_start();
                if let Some(rest) = rest.strip_prefix('=') {
                    let value = rest.trim().trim_matches('"').trim_matches('\'');
                    if !value.is_empty() {
                        return Some(value.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Busca TODAS las ocurrencias de un archivo por nombre exacto, saltando
/// directorios pesados/irrelevantes (`target`, `node_modules`, `.git`) —
/// necesario aquí (a diferencia de `java_source_roots`/`go_module_roots`,
/// que buscan a profundidad 1) porque esta búsqueda llega a profundidad 3
/// y `target/` puede ser muy grande en un crate ya compilado.
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
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if matches!(dir_name, "target" | "node_modules" | ".git") {
                    continue;
                }
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
    fn extracts_simple_package_name() {
        let content = "[package]\nname = \"my-crate\"\nversion = \"0.1.0\"\n";
        assert_eq!(extract_package_name(content), Some("my-crate".to_string()));
    }

    #[test]
    fn ignores_name_outside_package_section() {
        let content = "[dependencies]\nname = \"not-this-one\"\n\n[package]\nname = \"real-crate\"\n";
        assert_eq!(extract_package_name(content), Some("real-crate".to_string()));
    }

    #[test]
    fn none_without_package_section() {
        let content = "[workspace]\nmembers = [\"crates/*\"]\n";
        assert_eq!(extract_package_name(content), None);
    }

    #[test]
    fn detect_normalizes_hyphens_to_underscores() {
        let tmp = std::env::temp_dir().join(format!("saac_rust_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&tmp);
        fs::write(tmp.join("Cargo.toml"), "[package]\nname = \"my-crate\"\n").unwrap();
        let crates = detect_rust_crates(&tmp);
        assert_eq!(crates.len(), 1);
        assert_eq!(crates[0].crate_name, "my_crate");
        let _ = fs::remove_dir_all(&tmp);
    }
}
