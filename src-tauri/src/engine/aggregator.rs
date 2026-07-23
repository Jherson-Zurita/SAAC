//! aggregator.rs — Agrega los `WorkerAnalysisResult` de todos los archivos
//! de un proyecto en un modelo unificado: módulos con métricas de grafo
//! completas, dependencias resueltas (donde es posible) contra otros
//! módulos del proyecto, métricas agregadas de proyecto, y una detección
//! de estilo arquitectónico por heurística de nombres de carpeta.
//!
//! ## Qué SÍ calcula este archivo (ítem 3 del plan "Motor Backend Core")
//!
//! - **Resolución de dependencias**: para imports RELATIVOS (`./x`,
//!   `../x`, estilo TS/JS) resuelve con precisión combinando el
//!   directorio del módulo origen con el import y comparando contra los
//!   ids de módulo conocidos.
//!   - **Java**: imports de paquete (`com.example.Foo`) resueltos con
//!     precisión usando la ruta de paquete COMPLETA contra el sufijo de
//!     `module_id` que sigue a una raíz de fuentes conocida (`src/main/
//!     java` por convención, o rutas custom de `pom.xml`/`build.gradle*`
//!     — ver `engine::java_source_roots`). Resuelve a 0 o 1 archivo (un
//!     import Java nombra una clase = un archivo).
//!   - **Go**: imports de paquete (`github.com/user/proyecto/pkg/x`)
//!     resueltos con precisión contra el `module path` de `go.mod` (ver
//!     `engine::go_module_roots`). A diferencia de Java, un import Go
//!     resuelve a TODOS los archivos del directorio/paquete (semántica
//!     real de Go: se importa el paquete completo) — por eso el bucle de
//!     resolución de abajo soporta múltiples targets por dependencia.
//!   - **Rust**: imports `use crate::x::Y` / `use <crate>::x::Y`
//!     resueltos con precisión contra el crate al que pertenece el
//!     módulo origen (ver `engine::rust_crate_roots`). Resuelve a 0 o 1
//!     archivo, probando primero que el último segmento sea un ÍTEM
//!     dentro de un archivo (caso más común) y si no como archivo/módulo
//!     en sí (`mod.rs` o no).
//!   - **Todo lo demás** (namespaces C#, paquetes Python, Kotlin sin
//!     convención Java estándar): fallback conservador por nombre base
//!     (último segmento del path, separando por `/`, `.` o `::`) que
//!     SOLO resuelve cuando hay un único módulo candidato con ese nombre
//!     — con dos o más candidatos (basenames ambiguos como `utils`/
//!     `index`/`types`) la dependencia queda sin resolver (se conserva
//!     como arista con el string de import original, pero no participa
//!     en Ca/Ce internos) en vez de adivinar. Java/Go/Rust también caen a
//!     este fallback cuando su resolución específica no matchea (import
//!     de librería externa, archivo no incluido en el análisis, etc.).
//!   - **Limitación conocida restante**: C# (namespaces) y Kotlin (que no
//!     siempre sigue la convención de carpetas de Java) no tienen
//!     resolución específica todavía — dependen del fallback por
//!     basename.
//! - **Ca / Ce / Instability**: contados sobre el grafo de dependencias
//!   YA RESUELTAS (solo módulos internos) — ver la nota en
//!   `ModuleMetrics::from_worker` (amg.rs) sobre por qué esto reemplaza el
//!   `ce` crudo que calcula cada worker (que cuenta TODOS los imports,
//!   incluyendo librerías externas).
//! - **Abstractness / Distance**: `A` viene tal cual del worker (proporción
//!   de clases abstractas/interfaces, calculable sin contexto global);
//!   `D = |A + I - 1|` se calcula aquí porque depende de `I` (instability),
//!   que sí es global.
//! - **moduleCohesion**: proporción de imports que resolvieron a un módulo
//!   interno sobre el total de imports declarados por el archivo.
//! - **Dependencias cíclicas**: SCC vía Tarjan sobre el grafo resuelto —
//!   cualquier componente fuertemente conexa de tamaño > 1 es un ciclo.
//! - **LOC / LLOC / conteos**: sumas simples sobre todos los módulos.
//! - **Estilo arquitectónico**: heurística de nombres de carpeta
//!   (`adapters`+`domain` → hexagonal, `controllers`+`services` →
//!   layered, etc.), con una confianza aproximada = proporción de módulos
//!   que matchean la señal ganadora.
//!
//! ## Qué NO calcula (fuera de alcance de este pase)
//!
//! - No arma un `ArchitectureModelGraph` completo — devuelve
//!   `AggregatedProject`, más liviano. Construir el AMG final requiere
//!   `amgId`/`analysisRunId`/`projectId`/timestamps/versionado, que son
//!   responsabilidad de quien orqueste el análisis (`commands/
//!   analysis.rs`).
//! - No detecta antipatrones, ni genera Containers/ExternalSystems/Actors/
//!   diagramas C4 (§4.4, §4.6) — estructuras placeholder vacías en
//!   `amg.rs`, sin lógica de detección en ningún lado todavía.
//! - El call graph (`invocations`) se recolecta de los workers y se pasa
//!   a los generadores de diagramas suplementarios (Call Graph, Sequence,
//!   Dynamic, DFD). La resolución es intra-módulo (ver parsers).
//! - `quantumCount` y `fitnessScore` (§4.3.6, §7) quedan en 0 — dependen
//!   de sistemas (Architecture Quanta, Fitness Functions/Rules) no
//!   implementados en ningún punto del pipeline.
//! - No hace caché ni análisis incremental — eso es `cache.rs`.
//! - Resolución de imports C# (namespaces) y Kotlin fuera de convención
//!   Java estándar — pendiente, mismo tipo de trabajo que Java/Go/Rust
//!   pero sin hacer todavía.
//! - Diferenciación web/`modular-monolith`/`microservices` en la
//!   detección de estilo NO está implementada: requeriría analizar
//!   topología de dependencias entre "servicios" propios o detectar
//!   múltiples puntos de entrada/Containers — ninguno de los dos existe
//!   todavía. Con las señales de carpeta actuales, esos proyectos caerán
//!   en `Unknown` o en la señal más específica que sí matcheen (ej.
//!   `layered` si además tienen `controllers`/`services`).

use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::engine::amg::{
    Actor, Antipattern, AntipatternType, ArchStyle, C4Models, Container, Dependency, ExternalCall,
    ExternalSystem, Invocation, Language, Module, ModuleMetrics, ModuleType, ProjectMetrics,
    ProjectType, Severity, WorkerAnalysisResult,
};
use crate::engine::c4_generator::C4Generator;
use crate::engine::go_module_roots::GoModuleInfo;
use crate::engine::rust_crate_roots::RustCrateInfo;
use crate::workers::types::{AnalysisFileStatus, FileAnalysisOutcome};

/// Resultado de `Aggregator::aggregate` — todo lo que se puede calcular
/// con visibilidad total del proyecto, PERO sin los metadatos de
/// orquestación (IDs, timestamps) que le corresponden a quien construya
/// el `ArchitectureModelGraph` final a partir de esto.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregatedProject {
    pub modules: Vec<Module>,
    pub dependencies: Vec<Dependency>,
    pub metrics: ProjectMetrics,
    pub detected_style: ArchStyle,
    pub style_confidence: f64,
    pub antipatterns: Vec<Antipattern>,
    pub containers: Vec<Container>,
    pub external_systems: Vec<ExternalSystem>,
    pub actors: Vec<Actor>,
    pub external_calls: Vec<ExternalCall>,
    pub c4_models: C4Models,
}

pub struct Aggregator;

impl Aggregator {
    /// Punto de entrada principal: agrega los resultados por archivo de
    /// TODO el proyecto en un `AggregatedProject`.
    ///
    /// `java_source_roots`: raíces de fuentes Java detectadas (ver
    /// `engine::java_source_roots::detect_java_source_roots`), usadas
    /// para resolver imports de paquetes Java contra `module_id`.
    ///
    /// `go_modules`: módulos Go detectados (ver
    /// `engine::go_module_roots::detect_go_modules`), usados para
    /// resolver imports de paquetes Go contra `module_id`.
    ///
    /// `rust_crates`: crates Rust detectados (ver
    /// `engine::rust_crate_roots::detect_rust_crates`), usados para
    /// resolver imports `use crate::...`/`use <crate>::...` contra
    /// `module_id`.
    ///
    /// Para proyectos sin módulos del lenguaje correspondiente, pasar un
    /// slice vacío en cualquiera de los tres es válido y no tiene efecto.
    pub fn aggregate(
        worker_results: Vec<WorkerAnalysisResult>,
        java_source_roots: &[String],
        go_modules: &[GoModuleInfo],
        rust_crates: &[RustCrateInfo],
    ) -> AggregatedProject {
        let total_modules = worker_results.len();

        // ── Índices auxiliares para resolución de dependencias ──
        let known_ids: HashSet<&str> = worker_results
            .iter()
            .map(|r| r.module.id.as_str())
            .collect();

        let mut by_basename: HashMap<&str, Vec<&str>> = HashMap::new();
        // Índice específico para Java: sufijo de paquete (la parte del
        // module_id que sigue a una raíz de fuentes conocida, ej.
        // "com/example/service/UserRepository") -> module_id completo.
        let mut by_java_suffix: HashMap<String, Vec<&str>> = HashMap::new();
        // Índice específico para Go: import path lógico de paquete (ej.
        // "github.com/user/proyecto/pkg/service") -> TODOS los module_id
        // de archivos .go en ese directorio/paquete.
        let mut by_go_package_dir: HashMap<String, Vec<&str>> = HashMap::new();

        for r in &worker_results {
            let id = r.module.id.as_str();
            let basename = id.rsplit('/').next().unwrap_or(id);
            by_basename.entry(basename).or_default().push(id);

            if r.module.language == Language::Java {
                if let Some(suffix) = java_package_suffix(id, java_source_roots) {
                    by_java_suffix.entry(suffix).or_default().push(id);
                }
            }

            if r.module.language == Language::Go {
                if let Some(import_path) = go_import_path_for_module(id, go_modules) {
                    by_go_package_dir.entry(import_path).or_default().push(id);
                }
            }
        }

        // ── Pasada 1: resolver dependencias, acumular Ca/Ce como grafo ──
        let mut resolved_dependencies: Vec<Dependency> = Vec::new();
        // target_id -> set(source_id) sin duplicados, para Ca.
        let mut incoming_by_module: HashMap<String, HashSet<String>> = HashMap::new();
        // source_id -> set(target_id) sin duplicados, para Ce y detección de ciclos.
        let mut outgoing_by_module: HashMap<String, HashSet<String>> = HashMap::new();

        for r in &worker_results {
            let is_java_source = r.module.language == Language::Java;
            let is_go_source = r.module.language == Language::Go;
            let is_rust_source = r.module.language == Language::Rust;

            for dep in &r.dependencies {
                // Cada rama produce 0, 1 (caso general) o N targets (solo
                // Go, por su semántica de import a nivel de paquete/
                // directorio — ver docstring del módulo).
                let resolved_targets: Vec<String> = if dep.target.starts_with("./") || dep.target.starts_with("../") {
                    resolve_relative_import(&dep.source, &dep.target, &known_ids)
                        .into_iter()
                        .collect()
                } else if is_java_source {
                    resolve_java_package_import(&dep.target, &by_java_suffix)
                        .map(|s| vec![s])
                        .unwrap_or_else(|| {
                            resolve_by_basename(&dep.target, &by_basename)
                                .map(|s| vec![s.to_string()])
                                .unwrap_or_default()
                        })
                } else if is_go_source {
                    resolve_go_package_import(&dep.target, &by_go_package_dir).unwrap_or_else(|| {
                        resolve_by_basename(&dep.target, &by_basename)
                            .map(|s| vec![s.to_string()])
                            .unwrap_or_default()
                    })
                } else if is_rust_source {
                    resolve_rust_use_import(&dep.target, &dep.source, rust_crates, &known_ids)
                        .map(|s| vec![s])
                        .unwrap_or_else(|| {
                            resolve_by_basename(&dep.target, &by_basename)
                                .map(|s| vec![s.to_string()])
                                .unwrap_or_default()
                        })
                } else {
                    resolve_by_basename(&dep.target, &by_basename)
                        .map(|s| vec![s.to_string()])
                        .unwrap_or_default()
                };

                // Descarta self-imports espurios (un target resuelto que
                // apunta al propio módulo origen).
                let resolved_targets: Vec<String> = resolved_targets
                    .into_iter()
                    .filter(|t| t != &dep.source)
                    .collect();

                if resolved_targets.is_empty() {
                    // No resoluble contra ningún módulo interno conocido
                    // con confianza: se conserva la arista tal cual para
                    // no perder visibilidad de dependencias externas,
                    // simplemente no participa en Ca/Ce internos.
                    resolved_dependencies.push(dep.clone());
                } else {
                    for target_id in resolved_targets {
                        outgoing_by_module
                            .entry(dep.source.clone())
                            .or_default()
                            .insert(target_id.clone());
                        incoming_by_module
                            .entry(target_id.clone())
                            .or_default()
                            .insert(dep.source.clone());
                        resolved_dependencies.push(Dependency {
                            source: dep.source.clone(),
                            target: target_id,
                            kind: dep.kind,
                            weight: dep.weight,
                        });
                    }
                }
            }
        }

        // ── Pasada 2: ensamblar cada Module final con sus métricas completas ──
        let mut modules: Vec<Module> = Vec::with_capacity(total_modules);

        let mut sum_maintainability = 0.0f64;
        let mut sum_cc_avg = 0.0f64;
        let mut sum_instability = 0.0f64;
        let mut sum_abstractness = 0.0f64;
        let mut sum_distance = 0.0f64;
        let mut total_loc: u32 = 0;
        let mut total_lloc: u32 = 0;
        let mut total_classes: u32 = 0;
        let mut total_functions: u32 = 0;

        for r in &worker_results {
            let module_id = r.module.id.clone();

            let ce = outgoing_by_module
                .get(&module_id)
                .map(|s| s.len() as u32)
                .unwrap_or(0);
            let ca = incoming_by_module
                .get(&module_id)
                .map(|s| s.len() as u32)
                .unwrap_or(0);

            let instability = if ca + ce == 0 {
                0.0
            } else {
                ce as f64 / (ca + ce) as f64
            };

            let abstractness = r.module.metrics.abstractness;
            // Distancia de la Secuencia Principal (§4.3.4): |A + I - 1|
            let distance = (abstractness + instability - 1.0).abs();

            // moduleCohesion (§4.3.2): proporción de imports DECLARADOS que
            // resolvieron a un módulo interno conocido. Se mide sobre el
            // total de imports (r.module.imports, sin deduplicar por
            // destino) para reflejar la proporción real de líneas de
            // import, no solo la cuenta de módulos distintos (Ce).
            let total_imports = r.module.imports.len();
            let module_cohesion = if total_imports == 0 {
                // Sin imports declarados: no hay evidencia de acoplamiento
                // externo, se trata como plenamente cohesivo por
                // convención (evita dividir por cero y no castiga a hojas
                // del árbol de dependencias, ej. utilidades puras).
                1.0
            } else {
                ce as f64 / total_imports as f64
            };

            let final_metrics = ModuleMetrics::from_worker(
                r.module.metrics.clone(),
                ca,
                ce,
                instability,
                distance,
                module_cohesion,
            );

            sum_maintainability += final_metrics.maintainability_index;
            sum_cc_avg += final_metrics.cyclomatic_complexity_avg;
            sum_instability += instability;
            sum_abstractness += abstractness;
            sum_distance += distance;
            total_loc += r.module.loc;
            total_lloc += r.module.lloc;
            total_classes += r.module.classes.len() as u32;
            total_functions += r.module.functions.len() as u32;

            modules.push(Module {
                id: r.module.id.clone(),
                node_type: r.module.node_type,
                name: r.module.name.clone(),
                module_type: r.module.module_type,
                language: r.module.language,
                loc: r.module.loc,
                lloc: r.module.lloc,
                classes: r.module.classes.clone(),
                functions: r.module.functions.clone(),
                imports: r.module.imports.clone(),
                imported_by: incoming_by_module
                    .get(&module_id)
                    .map(|s| s.iter().cloned().collect())
                    .unwrap_or_default(),
                stable_since: r.module.stable_since.clone(),
                last_seen_in: r.module.last_seen_in.clone(),
                metrics: final_metrics,
            });
        }

        let divisor = (total_modules.max(1)) as f64;
        let metrics = ProjectMetrics {
            maintainability_index_avg: sum_maintainability / divisor,
            total_loc,
            total_lloc,
            total_modules: total_modules as u32,
            total_classes,
            total_functions,
            total_dependencies: resolved_dependencies.len() as u32,
            cyclic_dependency_count: count_cyclic_dependencies(&outgoing_by_module),
            avg_cyclomatic_complexity: sum_cc_avg / divisor,
            avg_instability: sum_instability / divisor,
            avg_abstractness: sum_abstractness / divisor,
            avg_distance: sum_distance / divisor,
            // Architecture Quantum (§4.3.6): detector no implementado.
            quantum_count: 0,
            // Requiere Rules/FitnessEvaluation (§7): no implementado.
            fitness_score: 0.0,
        };

        let (detected_style, style_confidence) = detect_architecture_style(&modules);

        // ── Acumular llamadas externas e invocations ──
        let mut raw_external_calls: Vec<ExternalCall> = Vec::new();
        let mut all_invocations: Vec<Invocation> = Vec::new();
        for r in &worker_results {
            raw_external_calls.extend(r.external_calls.clone());
            all_invocations.extend(r.invocations.clone());
        }

        // ── Detección de antipatrones ──
        let mut antipatterns: Vec<Antipattern> = Vec::new();
        antipatterns.extend(detect_god_modules(&modules, metrics.total_dependencies));
        antipatterns.extend(detect_circular_dependencies(&outgoing_by_module));
        antipatterns.extend(detect_layer_violations(
            &modules,
            &resolved_dependencies,
            detected_style,
        ));

        // ── Generación de Diagramas C4 e inferencia de contenedores/actores ──
        //
        // `antipatterns` se pasa aquí para que el diagrama suplementario de
        // dependencias circulares reutilice los `cycle_path` EXACTOS que ya
        // calculó `detect_circular_dependencies` (Tarjan + DFS) en vez de
        // recalcular "candidatos a ciclo" con una heurística propia.
        //
        // `all_invocations` se pasa para generar los diagramas basados en
        // traza: Call Graph, Sequence Diagram, Dynamic Diagram, DFD.
        let c4_output = C4Generator::generate(
            "Project",
            ProjectType::Desktop, // Se actualiza en compile_amg con el project_type detectado
            detected_style,
            &modules,
            &resolved_dependencies,
            &raw_external_calls,
            &antipatterns,
            &all_invocations,
        );

        AggregatedProject {
            modules,
            dependencies: resolved_dependencies,
            metrics,
            detected_style,
            style_confidence,
            antipatterns,
            containers: c4_output.containers,
            external_systems: c4_output.external_systems,
            actors: c4_output.actors,
            external_calls: raw_external_calls,
            c4_models: c4_output.c4_models,
        }
    }

    /// Convierte los `FileAnalysisOutcome` crudos de `analyze_project`
    /// (`commands/analysis.rs`) en `WorkerAnalysisResult` tipados,
    /// separando los que fallan al deserializar (JSON inesperado del
    /// worker — ver el mismatch conocido de `go.py`/`rust.py` en
    /// `FunctionInfo`, documentado en `amg.rs`) de los que sí se pudieron
    /// parsear.
    pub fn parse_worker_results(
        outcomes: &[FileAnalysisOutcome],
    ) -> (Vec<WorkerAnalysisResult>, Vec<(String, String)>) {
        let mut parsed = Vec::new();
        let mut failures = Vec::new();

        for outcome in outcomes {
            if outcome.status != AnalysisFileStatus::Success {
                continue;
            }
            let Some(value) = &outcome.result else {
                failures.push((
                    outcome.file_path.clone(),
                    "sin resultado a pesar de status success".to_string(),
                ));
                continue;
            };
            match serde_json::from_value::<WorkerAnalysisResult>(value.clone()) {
                Ok(result) => parsed.push(result),
                Err(e) => failures.push((outcome.file_path.clone(), e.to_string())),
            }
        }

        (parsed, failures)
    }
}

// ============================================================================
// Resolución de dependencias — genérica (relativos, fallback por basename)
// ============================================================================

/// Resuelve un import relativo (`./x`, `../x`) combinándolo con el
/// directorio del módulo origen y comparando contra los ids de módulo
/// conocidos (que son paths sin extensión, separados por `/` — convención
/// usada por los 6 parsers Python; se asume que el worker Node sigue la
/// misma, sin auditar su código en este pase). Prueba también con `/index`
/// añadido (`./utils` -> `.../utils/index`), caso común en TS/JS.
fn resolve_relative_import(source_id: &str, target: &str, known_ids: &HashSet<&str>) -> Option<String> {
    let source_dir = match source_id.rfind('/') {
        Some(idx) => &source_id[..idx],
        None => "",
    };

    let combined = if source_dir.is_empty() {
        target.to_string()
    } else {
        format!("{}/{}", source_dir, target)
    };

    let mut segments: Vec<&str> = Vec::new();
    for seg in combined.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            other => segments.push(other),
        }
    }
    let normalized = segments.join("/");

    let candidates = [normalized.clone(), format!("{}/index", normalized)];
    for candidate in &candidates {
        if known_ids.contains(candidate.as_str()) {
            return Some(candidate.clone());
        }
    }
    None
}

/// Fallback conservador para imports NO relativos (paquetes/namespaces
/// absolutos de cualquier lenguaje): compara el último segmento del
/// import (separando por `/`, `.` o `::`) contra el basename de los
/// módulos conocidos. Solo resuelve si hay EXACTAMENTE un candidato — con
/// dos o más (basenames ambiguos como `utils`/`index`/`types`) devuelve
/// `None` en vez de adivinar.
fn resolve_by_basename<'a>(target: &str, by_basename: &HashMap<&'a str, Vec<&'a str>>) -> Option<&'a str> {
    let normalized = target.trim_start_matches("./").trim_start_matches("../");
    let last_segment = normalized
        .split(|c: char| c == '/' || c == '.' || c == ':')
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(normalized);

    if last_segment.is_empty() {
        return None;
    }

    match by_basename.get(last_segment) {
        Some(candidates) if candidates.len() == 1 => Some(candidates[0]),
        _ => None,
    }
}

// ============================================================================
// Resolución de dependencias — Java
// ============================================================================

/// Dado el `module_id` (ruta de archivo, ej.
/// `myproject/src/main/java/com/example/service/UserRepository`) de un
/// módulo Java, devuelve el sufijo de paquete que sigue a la PRIMERA raíz
/// de fuentes conocida que aparezca como segmento de path completo dentro
/// del id (ej. `com/example/service/UserRepository`), o `None` si ninguna
/// raíz conocida aparece en el id.
fn java_package_suffix(module_id: &str, java_source_roots: &[String]) -> Option<String> {
    for root in java_source_roots {
        let needle = format!("{}/", root);
        if let Some(idx) = find_path_segment(module_id, &needle) {
            let suffix = &module_id[idx + needle.len()..];
            if !suffix.is_empty() {
                return Some(suffix.to_string());
            }
        }
    }
    None
}

/// Busca `needle` dentro de `haystack` como segmento de path alineado —
/// es decir, que la ocurrencia empiece justo después de un `/` (o al
/// inicio del string). Evita que `"src/main/java"` matchee dentro de
/// `"other-src/main/java"` por accidente de substring.
fn find_path_segment(haystack: &str, needle: &str) -> Option<usize> {
    let mut search_from = 0;
    while let Some(rel_idx) = haystack[search_from..].find(needle) {
        let idx = search_from + rel_idx;
        if idx == 0 || haystack.as_bytes()[idx - 1] == b'/' {
            return Some(idx);
        }
        search_from = idx + 1;
    }
    None
}

/// Resuelve un import Java (`dep.target`, ej.
/// `com.example.service.UserRepository`) contra el índice
/// `by_java_suffix` — convierte la notación de puntos a `/` y busca un
/// match EXACTO contra el sufijo de paquete de algún módulo conocido, así
/// que distingue correctamente `com.example.service.UserRepository` de
/// `com.other.UserRepository` aunque ambos compartan el basename
/// `UserRepository`. Solo resuelve con EXACTAMENTE un candidato.
fn resolve_java_package_import(target: &str, by_java_suffix: &HashMap<String, Vec<&str>>) -> Option<String> {
    let as_path = target.replace('.', "/");
    match by_java_suffix.get(as_path.as_str()) {
        Some(candidates) if candidates.len() == 1 => Some(candidates[0].to_string()),
        _ => None,
    }
}

// ============================================================================
// Resolución de dependencias — Go
// ============================================================================

/// Calcula el import path Go lógico correspondiente a un `module_id` de
/// un archivo `.go`, dados los módulos Go conocidos del proyecto — ej.
/// `.../myproject/pkg/service/handler` con
/// `GoModuleInfo { module_path: "github.com/user/myproject", dir: ".../myproject" }`
/// da `"github.com/user/myproject/pkg/service"` — SIN nombre de archivo,
/// porque el import path de Go es de PAQUETE/directorio (ver docstring
/// del módulo `go_module_roots.rs`).
///
/// Si varios `GoModuleInfo` matchean como prefijo (submódulos anidados),
/// usa el de `dir` MÁS LARGO — el módulo Go más "cercano" en el árbol de
/// directorios al archivo.
fn go_import_path_for_module(module_id: &str, go_modules: &[GoModuleInfo]) -> Option<String> {
    let best = go_modules
        .iter()
        .filter(|m| module_id.starts_with(&format!("{}/", m.dir)))
        .max_by_key(|m| m.dir.len())?;

    let package_dir = match module_id.rfind('/') {
        Some(idx) => &module_id[..idx],
        None => return None,
    };
    let relative_dir = package_dir.get(best.dir.len()..)?;

    Some(format!("{}{}", best.module_path, relative_dir))
}

/// Resuelve un import Go (`dep.target`, ej.
/// `github.com/user/myproject/pkg/service`) contra el índice
/// `by_go_package_dir` (import path lógico -> TODOS los archivos de ese
/// paquete) — lookup exacto, ya que ambos lados se calculan con la misma
/// fórmula (`go_import_path_for_module`). Devuelve TODOS los archivos del
/// paquete (semántica real de Go: se importa el paquete completo, no un
/// archivo), o `None` si el import no matchea ningún paquete interno
/// conocido (librería externa, o paquete no incluido en el análisis).
fn resolve_go_package_import(target: &str, by_go_package_dir: &HashMap<String, Vec<&str>>) -> Option<Vec<String>> {
    by_go_package_dir
        .get(target)
        .map(|files| files.iter().map(|s| s.to_string()).collect())
}

// ============================================================================
// Resolución de dependencias — Rust
// ============================================================================

/// Resuelve un import Rust (`use crate::foo::Bar` o `use my_crate::foo::
/// Bar`) contra el crate al que pertenece el módulo ORIGEN
/// (`source_module_id`) — el `RustCrateInfo` de `dir` con prefijo más
/// largo que matchea, igual criterio que `go_import_path_for_module`.
///
/// Prueba, en orden: (1) el path SIN su último segmento, asumiendo que
/// ese último segmento es un ÍTEM (struct/función/enum) definido DENTRO
/// de un archivo, no un archivo en sí (`use crate::engine::amg::Module`
/// -> el archivo es `engine/amg`, `Module` es un ítem adentro) — el caso
/// más común, probado primero; (2) el path completo como archivo/módulo
/// en sí (`use crate::engine::amg;`); (3) el mismo path como directorio
/// con `mod.rs` (convención antigua).
fn resolve_rust_use_import(
    target: &str,
    source_module_id: &str,
    rust_crates: &[RustCrateInfo],
    known_ids: &HashSet<&str>,
) -> Option<String> {
    let owning_crate = rust_crates
        .iter()
        .filter(|c| source_module_id.starts_with(&format!("{}/", c.dir)))
        .max_by_key(|c| c.dir.len())?;

    let crate_prefix = format!("{}::", owning_crate.crate_name);
    let path_after_prefix = target
        .strip_prefix("crate::")
        .or_else(|| target.strip_prefix(crate_prefix.as_str()))?;

    let src_root = format!("{}/src", owning_crate.dir);
    let as_path = path_after_prefix.replace("::", "/");

    let mut candidates: Vec<String> = Vec::new();
    if let Some(idx) = path_after_prefix.rfind("::") {
        let without_last_segment = path_after_prefix[..idx].replace("::", "/");
        candidates.push(format!("{}/{}", src_root, without_last_segment));
        candidates.push(format!("{}/{}/mod", src_root, without_last_segment));
    }
    candidates.push(format!("{}/{}", src_root, as_path));
    candidates.push(format!("{}/{}/mod", src_root, as_path));

    candidates.into_iter().find(|c| known_ids.contains(c.as_str()))
}

// ============================================================================
// Detección de antipatrones — §4.6
// ============================================================================

/// Detecta módulos con Efferent Coupling excesivo (Ce > 15 ó > 20% del
/// total de dependencias resueltas del proyecto).
fn detect_god_modules(modules: &[Module], total_dependencies: u32) -> Vec<Antipattern> {
    let mut result = Vec::new();
    let threshold_abs: u32 = 15;

    for m in modules {
        let ce = m.metrics.ce;
        let pct = if total_dependencies > 0 {
            ce as f64 / total_dependencies as f64
        } else {
            0.0
        };

        let is_god = ce > threshold_abs || (total_dependencies > 0 && pct > 0.20);

        if is_god {
            let short_name = m.id.rsplit('/').next().unwrap_or(&m.id);
            result.push(Antipattern {
                id: format!("antipattern:god-module:{}", short_name),
                antipattern_type: AntipatternType::GodModule,
                name: "God Module".to_string(),
                severity: Severity::High,
                description: format!(
                    "Module '{}' has excessive efferent coupling (Ce = {}, {:.1}% of project dependencies). \
                     It depends on too many other modules, making it a change bottleneck.",
                    m.name, ce, pct * 100.0
                ),
                affected_module_ids: vec![m.id.clone()],
                cycle_path: None,
                suggested_break_point: None,
                refactor_suggestion: Some(
                    "Split this module into smaller, focused modules with single responsibilities \
                     to reduce coupling and improve maintainability."
                        .to_string(),
                ),
                ignored: false,
                ignore_justification: None,
            });
        }
    }
    result
}

/// Detecta todos los ciclos simples en el grafo de dependencias resueltas
/// usando DFS. Cada ciclo detectado se normaliza (rotación para empezar por
/// el id lexicográficamente menor) para evitar reportar el mismo ciclo
/// múltiples veces con diferentes puntos de entrada.
fn detect_circular_dependencies(
    graph: &HashMap<String, HashSet<String>>,
) -> Vec<Antipattern> {
    let mut unique_cycles: HashSet<Vec<String>> = HashSet::new();
    let mut visited: HashSet<String> = HashSet::new();
    let mut stack: Vec<String> = Vec::new();
    let mut in_stack: HashSet<String> = HashSet::new();

    fn dfs(
        node: &str,
        graph: &HashMap<String, HashSet<String>>,
        visited: &mut HashSet<String>,
        stack: &mut Vec<String>,
        in_stack: &mut HashSet<String>,
        unique_cycles: &mut HashSet<Vec<String>>,
    ) {
        stack.push(node.to_string());
        in_stack.insert(node.to_string());

        if let Some(neighbors) = graph.get(node) {
            for neighbor in neighbors {
                if in_stack.contains(neighbor.as_str()) {
                    // Encontrado un ciclo: extraer la ruta desde `neighbor`
                    // hasta el final del stack, y cerrar con `neighbor`.
                    let cycle_start = stack
                        .iter()
                        .position(|n| n == neighbor)
                        .unwrap_or(0);
                    let mut cycle: Vec<String> = stack[cycle_start..].to_vec();
                    cycle.push(neighbor.clone()); // cerrar el ciclo

                    // Normalizar: rotar para que empiece por el menor id
                    let cycle_body = &cycle[..cycle.len() - 1]; // sin el cierre
                    if let Some(min_pos) = cycle_body
                        .iter()
                        .enumerate()
                        .min_by_key(|(_, id)| id.as_str())
                        .map(|(i, _)| i)
                    {
                        let mut normalized: Vec<String> = Vec::with_capacity(cycle.len());
                        for i in 0..cycle_body.len() {
                            normalized.push(
                                cycle_body[(min_pos + i) % cycle_body.len()].clone(),
                            );
                        }
                        normalized.push(normalized[0].clone()); // cerrar
                        unique_cycles.insert(normalized);
                    }
                } else if !visited.contains(neighbor.as_str()) {
                    dfs(neighbor, graph, visited, stack, in_stack, unique_cycles);
                }
            }
        }

        stack.pop();
        in_stack.remove(node);
        visited.insert(node.to_string());
    }

    let all_nodes: HashSet<String> = graph
        .keys()
        .cloned()
        .chain(graph.values().flatten().cloned())
        .collect();

    for node in &all_nodes {
        if !visited.contains(node) {
            dfs(node, graph, &mut visited, &mut stack, &mut in_stack, &mut unique_cycles);
        }
    }

    unique_cycles
        .into_iter()
        .map(|cycle| {
            let affected: Vec<String> = cycle[..cycle.len() - 1].to_vec();
            let cycle_display: Vec<String> = affected
                .iter()
                .map(|id| id.rsplit('/').next().unwrap_or(id).to_string())
                .collect();

            // `break_src`/`break_tgt` se materializan como `String` propios (no
            // `&str` prestados de `cycle`) precisamente porque más abajo se
            // mueve `cycle` completo hacia `cycle_path: Some(cycle)` — si
            // fueran referencias, ese `move` entraría en conflicto con el
            // préstamo todavía vivo en `suggested_break_point` (E0505: cannot
            // move out of `cycle` because it is borrowed).
            let break_src: String = cycle[cycle.len() - 2]
                .rsplit('/')
                .next()
                .unwrap_or(&cycle[cycle.len() - 2])
                .to_string();
            let break_tgt: String = cycle[0].rsplit('/').next().unwrap_or(&cycle[0]).to_string();

            Antipattern {
                id: format!(
                    "antipattern:circular-dependency:{}-to-{}",
                    cycle_display.first().unwrap_or(&"?".to_string()),
                    cycle_display.last().unwrap_or(&"?".to_string()),
                ),
                antipattern_type: AntipatternType::CircularDependency,
                name: "Circular Dependency".to_string(),
                severity: Severity::Critical,
                description: format!(
                    "Circular dependency detected: {}",
                    cycle_display.join(" → ")
                ),
                affected_module_ids: affected,
                cycle_path: Some(cycle),
                suggested_break_point: Some(format!("{} → {}", break_src, break_tgt)),
                refactor_suggestion: Some(
                    "Introduce an abstraction/interface, use dependency injection, or move \
                     shared logic to a separate common module to break the circular reference."
                        .to_string(),
                ),
                ignored: false,
                ignore_justification: None,
            }
        })
        .collect()
}

/// Asigna un rango jerárquico a un módulo según el estilo arquitectónico
/// detectado. Usa `ModuleType` como señal primaria (fuente de verdad única
/// compartida con la UI) y recurre a heurística de carpetas solo cuando el
/// tipo es `Unknown` o no tiene un mapeo definido para ese estilo.
///
/// Retorna `None` si no se puede clasificar (módulos neutrales como Util,
/// Config, Test, Dto que no participan en la jerarquía de capas).
fn infer_layer(module: &Module, style: ArchStyle) -> Option<u32> {
    // 1. Mapeo primario por ModuleType
    let by_type = match style {
        ArchStyle::Layered => match module.module_type {
            ModuleType::Controller | ModuleType::UiComponent | ModuleType::Middleware => Some(3),
            ModuleType::Service | ModuleType::Store | ModuleType::Hook | ModuleType::Factory => {
                Some(2)
            }
            ModuleType::Repository | ModuleType::Model => Some(1),
            _ => None,
        },
        ArchStyle::Hexagonal => match module.module_type {
            ModuleType::Controller
            | ModuleType::Repository
            | ModuleType::UiComponent
            | ModuleType::Middleware => Some(3),
            ModuleType::Service => Some(2),
            ModuleType::Model => Some(1),
            _ => None,
        },
        _ => return None, // Solo aplicable a Layered y Hexagonal
    };

    if by_type.is_some() {
        return by_type;
    }

    // 2. Fallback: heurística de carpetas (para Unknown o tipos no mapeados)
    let path_lower = module.id.to_lowercase();
    let segments: HashSet<&str> = path_lower.split('/').collect();
    let has = |names: &[&str]| names.iter().any(|n| segments.contains(n));

    match style {
        ArchStyle::Layered => {
            if has(&[
                "controllers",
                "controller",
                "api",
                "web",
                "handlers",
                "handler",
            ]) {
                Some(3)
            } else if has(&["services", "service", "logic", "usecases", "usecase"]) {
                Some(2)
            } else if has(&[
                "repositories",
                "repository",
                "models",
                "model",
                "entities",
                "entity",
                "db",
                "dao",
            ]) {
                Some(1)
            } else {
                None
            }
        }
        ArchStyle::Hexagonal => {
            if has(&["adapters", "adapter", "infrastructure", "infra", "ui"]) {
                Some(3)
            } else if has(&["ports", "port"]) {
                Some(2)
            } else if has(&["domain", "core", "entities", "entity"]) {
                Some(1)
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Detecta dependencias en sentido ascendente (capa inferior → capa
/// superior) según el estilo arquitectónico detectado, usando `infer_layer`
/// para clasificar cada módulo.
fn detect_layer_violations(
    modules: &[Module],
    dependencies: &[Dependency],
    detected_style: ArchStyle,
) -> Vec<Antipattern> {
    if !matches!(detected_style, ArchStyle::Layered | ArchStyle::Hexagonal) {
        return Vec::new();
    }

    // Pre-computar rangos de capa para todos los módulos
    let layer_by_id: HashMap<&str, u32> = modules
        .iter()
        .filter_map(|m| infer_layer(m, detected_style).map(|rank| (m.id.as_str(), rank)))
        .collect();

    let style_name = match detected_style {
        ArchStyle::Layered => "Layered",
        ArchStyle::Hexagonal => "Hexagonal",
        _ => "Unknown",
    };

    let layer_name = |rank: u32| -> &'static str {
        match (detected_style, rank) {
            (ArchStyle::Layered, 3) => "Controller/UI",
            (ArchStyle::Layered, 2) => "Service/Logic",
            (ArchStyle::Layered, 1) => "Repository/Model",
            (ArchStyle::Hexagonal, 3) => "Adapter/Infrastructure",
            (ArchStyle::Hexagonal, 2) => "Port/UseCase",
            (ArchStyle::Hexagonal, 1) => "Domain/Core",
            _ => "Unknown",
        }
    };

    let mut violations = Vec::new();
    // Deduplicar: misma source+target solo genera 1 violación
    let mut seen: HashSet<(String, String)> = HashSet::new();

    for dep in dependencies {
        let src_rank = layer_by_id.get(dep.source.as_str()).copied();
        let tgt_rank = layer_by_id.get(dep.target.as_str()).copied();

        if let (Some(sr), Some(tr)) = (src_rank, tgt_rank) {
            if sr < tr && seen.insert((dep.source.clone(), dep.target.clone())) {
                let src_short = dep.source.rsplit('/').next().unwrap_or(&dep.source);
                let tgt_short = dep.target.rsplit('/').next().unwrap_or(&dep.target);
                violations.push(Antipattern {
                    id: format!(
                        "antipattern:layer-violation:{}-to-{}",
                        src_short, tgt_short
                    ),
                    antipattern_type: AntipatternType::LayerViolation,
                    name: "Layer Violation".to_string(),
                    severity: Severity::High,
                    description: format!(
                        "Layer violation in {} architecture: '{}' ({} layer) depends on '{}' \
                         ({} layer). Dependencies must only flow downward.",
                        style_name,
                        src_short,
                        layer_name(sr),
                        tgt_short,
                        layer_name(tr),
                    ),
                    affected_module_ids: vec![dep.source.clone(), dep.target.clone()],
                    cycle_path: None,
                    suggested_break_point: Some(format!("{} → {}", src_short, tgt_short)),
                    refactor_suggestion: Some(format!(
                        "Apply Dependency Inversion: introduce an abstraction in the {} layer \
                         that the {} layer implements, so the dependency flows downward.",
                        layer_name(sr),
                        layer_name(tr),
                    )),
                    ignored: false,
                    ignore_justification: None,
                });
            }
        }
    }

    violations
}

// ============================================================================
// Detección de ciclos (Tarjan SCC)
// ============================================================================

/// Cuenta cuántas componentes fuertemente conexas (SCC) de tamaño > 1
/// tiene el grafo de dependencias RESUELTAS (`outgoing_by_module`) — cada
/// una es un ciclo de dependencias.
///
/// Implementación recursiva por simplicidad. En un grafo con una cadena
/// de miles de módulos de profundidad podría acercarse al límite de stack
/// de Rust; no se ha observado ese caso en la práctica y no se optimizó a
/// una versión iterativa por adelantado.
fn count_cyclic_dependencies(graph: &HashMap<String, HashSet<String>>) -> u32 {
    struct TarjanState<'a> {
        graph: &'a HashMap<String, HashSet<String>>,
        index_counter: usize,
        stack: Vec<String>,
        on_stack: HashSet<String>,
        indices: HashMap<String, usize>,
        lowlink: HashMap<String, usize>,
        cyclic_count: u32,
    }

    impl<'a> TarjanState<'a> {
        fn strongconnect(&mut self, node: &str) {
            self.indices.insert(node.to_string(), self.index_counter);
            self.lowlink.insert(node.to_string(), self.index_counter);
            self.index_counter += 1;
            self.stack.push(node.to_string());
            self.on_stack.insert(node.to_string());

            if let Some(neighbors) = self.graph.get(node) {
                for neighbor in neighbors {
                    if !self.indices.contains_key(neighbor) {
                        self.strongconnect(neighbor);
                        let neighbor_low = self.lowlink[neighbor];
                        let node_low = self.lowlink[node];
                        self.lowlink.insert(node.to_string(), node_low.min(neighbor_low));
                    } else if self.on_stack.contains(neighbor) {
                        let neighbor_idx = self.indices[neighbor];
                        let node_low = self.lowlink[node];
                        self.lowlink.insert(node.to_string(), node_low.min(neighbor_idx));
                    }
                }
            }

            if self.lowlink[node] == self.indices[node] {
                let mut scc_size = 0;
                loop {
                    let w = self.stack.pop().expect("stack de Tarjan vacío inesperadamente");
                    self.on_stack.remove(&w);
                    scc_size += 1;
                    if w == node {
                        break;
                    }
                }
                if scc_size > 1 {
                    self.cyclic_count += 1;
                }
            }
        }
    }

    let mut state = TarjanState {
        graph,
        index_counter: 0,
        stack: Vec::new(),
        on_stack: HashSet::new(),
        indices: HashMap::new(),
        lowlink: HashMap::new(),
        cyclic_count: 0,
    };

    let all_nodes: HashSet<String> = graph
        .keys()
        .cloned()
        .chain(graph.values().flatten().cloned())
        .collect();

    for node in &all_nodes {
        if !state.indices.contains_key(node) {
            state.strongconnect(node);
        }
    }

    state.cyclic_count
}

// ============================================================================
// Detección de estilo arquitectónico (heurística de nombres de carpeta)
// ============================================================================

/// Heurística de un solo pase basada en nombres de carpeta presentes en
/// los ids de módulo.
///
/// IMPORTANTE — corrección de un bug real: la condición de cada estilo es
/// del tipo `has(carpetas_tipo_A) && has(carpetas_tipo_B)` (ej. Layered
/// necesita `controllers` Y `services` en alguna parte del PROYECTO). La
/// primera versión de esta función evaluaba esa condición POR MÓDULO
/// INDIVIDUAL dentro del loop (`for m in modules`), lo que exige que un
/// mismo archivo tenga simultáneamente `controllers` Y `services` en su
/// propio path — algo que casi nunca ocurre, porque un archivo vive en una
/// sola carpeta. El síntoma observado: proyectos con la estructura
/// Layered de manual (`controllers/`, `services/`, `repositories/` como
/// carpetas hermanas) caían en `Unknown` con confianza 0, porque ningún
/// módulo individual matcheaba ambas condiciones a la vez.
///
/// El fix: primero se recolecta el conjunto de segmentos de carpeta
/// presentes en TODO el proyecto (unión sobre todos los módulos), y las
/// condiciones `has(A) && has(B)` se evalúan UNA vez sobre ese conjunto
/// global. Para la confianza (proporción 0-1), se cuenta aparte cuántos
/// módulos individuales pertenecen a alguna de las carpetas señal del
/// estilo ganador — esa sí es una medida legítima por módulo (qué tan
/// extendida está la convención en el proyecto), distinta de la detección
/// del estilo en sí (que es una propiedad del proyecto completo).
fn detect_architecture_style(modules: &[Module]) -> (ArchStyle, f64) {
    // Unión de todos los segmentos de carpeta presentes en el proyecto.
    let mut project_segments: HashSet<String> = HashSet::new();
    for m in modules {
        let path_lower = m.id.to_lowercase();
        project_segments.extend(path_lower.split('/').map(|s| s.to_string()));
    }
    let has = |names: &[&str]| names.iter().any(|n| project_segments.contains(*n));

    let mut candidates: Vec<(ArchStyle, &[&str], &[&str])> = Vec::new();
    if has(&["adapters", "adapter"]) && has(&["domain", "ports", "port"]) {
        candidates.push((
            ArchStyle::Hexagonal,
            &["adapters", "adapter"],
            &["domain", "ports", "port"],
        ));
    }
    if has(&["controllers", "controller"]) && has(&["services", "service"]) {
        candidates.push((
            ArchStyle::Layered,
            &["controllers", "controller"],
            &["services", "service"],
        ));
    }
    if has(&["events", "handlers"]) && has(&["publishers", "subscribers", "listeners"]) {
        candidates.push((
            ArchStyle::EventDriven,
            &["events", "handlers"],
            &["publishers", "subscribers", "listeners"],
        ));
    }
    if has(&["commands"]) && has(&["queries"]) {
        candidates.push((ArchStyle::Cqrs, &["commands"], &["queries"]));
    }
    if has(&["plugins", "extensions"]) && has(&["core"]) {
        candidates.push((ArchStyle::Microkernel, &["plugins", "extensions"], &["core"]));
    }

    if candidates.is_empty() {
        return (ArchStyle::Unknown, 0.0);
    }

    // Entre los estilos cuya condición matchea a nivel de proyecto, se
    // elige el que tiene más módulos individuales participando en
    // cualquiera de sus dos grupos de carpetas señal — esto sirve tanto de
    // desempate (proyectos con señales de más de un estilo) como de base
    // para la confianza reportada.
    let mut best: Option<(ArchStyle, u32)> = None;
    for (style, group_a, group_b) in &candidates {
        let matching_modules = modules
            .iter()
            .filter(|m| {
                let path_lower = m.id.to_lowercase();
                let segments: HashSet<&str> = path_lower.split('/').collect();
                group_a.iter().any(|n| segments.contains(n))
                    || group_b.iter().any(|n| segments.contains(n))
            })
            .count() as u32;

        if best.map(|(_, count)| matching_modules > count).unwrap_or(true) {
            best = Some((*style, matching_modules));
        }
    }

    match best {
        Some((style, count)) => {
            let confidence = (count as f64 / modules.len().max(1) as f64).min(1.0);
            (style, confidence)
        }
        None => (ArchStyle::Unknown, 0.0),
    }
}