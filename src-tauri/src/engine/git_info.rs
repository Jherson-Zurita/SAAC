//! git_info.rs — Extractor de Metadatos de Git.
//!
//! Ejecuta comandos de `git` para extraer información de autoría (Ownership),
//! historial de commits por módulo y cálculo de bus-factor.

use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleOwnership {
    pub module_id: String,
    pub main_author: String,
    pub total_commits: u32,
    pub authors: HashMap<String, u32>,
    pub bus_factor_risk: bool,
}

pub struct GitInfoExtractor;

impl GitInfoExtractor {
    /// Extrae metadatos de ownership de Git para la lista de módulos.
    pub fn extract_ownership(project_path: &Path, module_ids: &[String]) -> HashMap<String, ModuleOwnership> {
        let mut ownership_map = HashMap::new();

        // Verificar si es un repositorio git
        let is_git = Command::new("git")
            .arg("rev-parse")
            .arg("--is-inside-work-tree")
            .current_dir(project_path)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if !is_git {
            // Fallback para repositorios sin git inicializado
            for id in module_ids {
                let mut authors = HashMap::new();
                authors.insert("Unknown Author".to_string(), 1);
                ownership_map.insert(
                    id.clone(),
                    ModuleOwnership {
                        module_id: id.clone(),
                        main_author: "Unknown Author".to_string(),
                        total_commits: 1,
                        authors,
                        bus_factor_risk: false,
                    },
                );
            }
            return ownership_map;
        }

        // Para cada módulo, ejecutar git log --follow --format="%an" <file>
        for id in module_ids {
            let output = Command::new("git")
                .arg("log")
                .arg("--follow")
                .arg("--format=%an")
                .arg(id)
                .current_dir(project_path)
                .output();

            if let Ok(out) = output {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    let mut author_counts: HashMap<String, u32> = HashMap::new();
                    let mut total_commits = 0;

                    for line in text.lines() {
                        let name = line.trim();
                        if !name.is_empty() {
                            *author_counts.entry(name.to_string()).or_insert(0) += 1;
                            total_commits += 1;
                        }
                    }

                    if total_commits > 0 {
                        let mut main_author = "Unknown Author".to_string();
                        let mut max_count = 0;

                        for (author, count) in &author_counts {
                            if *count > max_count {
                                max_count = *count;
                                main_author = author.clone();
                            }
                        }

                        // Bus factor risk: si un solo autor domina > 80% de los commits de un módulo con > 3 commits
                        let bus_factor_risk = total_commits >= 3 && (max_count as f32 / total_commits as f32) > 0.8;

                        ownership_map.insert(
                            id.clone(),
                            ModuleOwnership {
                                module_id: id.clone(),
                                main_author,
                                total_commits,
                                authors: author_counts,
                                bus_factor_risk,
                            },
                        );
                        continue;
                    }
                }
            }

            // Fallback por defecto si no hubo commits registrados para este archivo
            let mut authors = HashMap::new();
            authors.insert("Initial Dev".to_string(), 1);
            ownership_map.insert(
                id.clone(),
                ModuleOwnership {
                    module_id: id.clone(),
                    main_author: "Initial Dev".to_string(),
                    total_commits: 1,
                    authors,
                    bus_factor_risk: false,
                },
            );
        }

        ownership_map
    }
}
