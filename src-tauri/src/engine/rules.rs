//! rules.rs — Motor de Reglas de Arquitectura (Fitness Functions) y cálculo del Fitness Score.
//! Soporta reglas por defecto y configuración personalizada persistida en `.saac/rules.json`.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::engine::amg::ArchitectureModelGraph;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: String, // "critical" | "high" | "medium" | "low"
    pub weight: f64,
    pub enabled: bool,
    pub condition: String, // e.g. "max_ce <= 15", "no_circular_dependencies", "layer_integrity"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleConfig {
    pub rules: Vec<Rule>,
}

impl Default for RuleConfig {
    fn default() -> Self {
        Self {
            rules: vec![
                Rule {
                    id: "no-god-modules".to_string(),
                    name: "Sin Módulos Gigantes (God Modules)".to_string(),
                    description: "Ningún módulo debe exceder 15 dependencias eferentes (Ce)".to_string(),
                    severity: "critical".to_string(),
                    weight: 25.0,
                    enabled: true,
                    condition: "max_ce <= 15".to_string(),
                },
                Rule {
                    id: "no-circular-dependencies".to_string(),
                    name: "Sin Ciclos de Dependencia".to_string(),
                    description: "No debe haber ciclos de dependencia entre módulos".to_string(),
                    severity: "critical".to_string(),
                    weight: 35.0,
                    enabled: true,
                    condition: "cyclic_dependency_count == 0".to_string(),
                },
                Rule {
                    id: "layer-architecture-integrity".to_string(),
                    name: "Respetar Jerarquía de Capas".to_string(),
                    description: "Las capas inferiores no deben importar componentes de capas superiores".to_string(),
                    severity: "high".to_string(),
                    weight: 20.0,
                    enabled: true,
                    condition: "layer_violation_count == 0".to_string(),
                },
                Rule {
                    id: "maintainability-threshold".to_string(),
                    name: "Índice de Mantenibilidad Mínimo".to_string(),
                    description: "El índice de mantenibilidad global debe ser mayor o igual a 60".to_string(),
                    severity: "medium".to_string(),
                    weight: 20.0,
                    enabled: true,
                    condition: "maintainability_index_avg >= 60".to_string(),
                },
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleEvaluationItem {
    pub rule_id: String,
    pub rule_name: String,
    pub severity: String,
    pub passed: bool,
    pub score: f64,
    pub weight: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FitnessEvaluationResult {
    pub fitness_score: f64, // 0.0 a 100.0
    pub total_rules: usize,
    pub passed_rules: usize,
    pub failed_rules: usize,
    pub evaluations: Vec<RuleEvaluationItem>,
}

pub struct RulesEngine;

impl RulesEngine {
    /// Carga la configuración de reglas desde `.saac/rules.json`.
    pub fn load_rules_config(project_path: &str) -> RuleConfig {
        let path = Path::new(project_path).join(".saac").join("rules.json");
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str::<RuleConfig>(&content) {
                    return config;
                }
            }
        }
        RuleConfig::default()
    }

    /// Guarda la configuración de reglas en `.saac/rules.json`.
    pub fn save_rules_config(project_path: &str, config: &RuleConfig) -> Result<(), String> {
        let saac_dir = Path::new(project_path).join(".saac");
        if !saac_dir.exists() {
            fs::create_dir_all(&saac_dir).map_err(|e| e.to_string())?;
        }
        let file_path = saac_dir.join("rules.json");
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Evalúa las reglas activas sobre el ArchitectureModelGraph.
    pub fn evaluate(amg: &ArchitectureModelGraph, config: &RuleConfig) -> FitnessEvaluationResult {
        let mut evaluations = Vec::new();
        let mut total_weight = 0.0;
        let mut earned_weight = 0.0;
        let mut passed_count = 0;
        let mut failed_count = 0;

        let circular_antipatterns = amg
            .antipatterns
            .iter()
            .filter(|a| matches!(a.antipattern_type, crate::engine::amg::AntipatternType::CircularDependency))
            .count();

        let layer_violations = amg
            .antipatterns
            .iter()
            .filter(|a| matches!(a.antipattern_type, crate::engine::amg::AntipatternType::LayerViolation))
            .count();

        let god_modules = amg
            .antipatterns
            .iter()
            .filter(|a| matches!(a.antipattern_type, crate::engine::amg::AntipatternType::GodModule))
            .count();

        for rule in &config.rules {
            if !rule.enabled {
                continue;
            }

            total_weight += rule.weight;
            let (passed, message) = match rule.id.as_str() {
                "no-god-modules" => {
                    if god_modules == 0 {
                        (true, "No se detectaron God Modules.".to_string())
                    } else {
                        (false, format!("Se detectaron {} God Module(s).", god_modules))
                    }
                }
                "no-circular-dependencies" => {
                    if circular_antipatterns == 0 {
                        (true, "No hay ciclos de dependencia.".to_string())
                    } else {
                        (false, format!("Se detectaron {} ciclo(s) de dependencia.", circular_antipatterns))
                    }
                }
                "layer-architecture-integrity" => {
                    if layer_violations == 0 {
                        (true, "Se respeta la jerarquía de capas.".to_string())
                    } else {
                        (false, format!("Se detectaron {} violación(es) de capa.", layer_violations))
                    }
                }
                "maintainability-threshold" => {
                    let avg_mi = amg.metrics.maintainability_index_avg;
                    if avg_mi >= 60.0 {
                        (true, format!("Índice de mantenibilidad aceptable: {:.1}", avg_mi))
                    } else {
                        (false, format!("Índice de mantenibilidad deficiente: {:.1} (requerido >= 60)", avg_mi))
                    }
                }
                _ => {
                    // Regla personalizada genérica: aprobada si no hay antipatrones en el proyecto
                    if amg.antipatterns.is_empty() {
                        (true, "Regla cumplida.".to_string())
                    } else {
                        (false, "Fallo genérico por presencia de antipatrones.".to_string())
                    }
                }
            };

            if passed {
                earned_weight += rule.weight;
                passed_count += 1;
            } else {
                failed_count += 1;
            }

            evaluations.push(RuleEvaluationItem {
                rule_id: rule.id.clone(),
                rule_name: rule.name.clone(),
                severity: rule.severity.clone(),
                passed,
                score: if passed { rule.weight } else { 0.0 },
                weight: rule.weight,
                message,
            });
        }

        let fitness_score = if total_weight > 0.0 {
            (earned_weight / total_weight) * 100.0
        } else {
            100.0
        };

        FitnessEvaluationResult {
            fitness_score: (fitness_score * 10.0).round() / 10.0,
            total_rules: evaluations.len(),
            passed_rules: passed_count,
            failed_rules: failed_count,
            evaluations,
        }
    }
}
