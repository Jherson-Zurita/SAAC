//! c4_generator.rs — Generador automático de Diagramas del Modelo C4 y Suplementarios.
//!
//! §4.4 de la especificación técnica SAAC: genera los diagramas de C4:
//!   - Nivel 1: Contexto del Sistema (Actores, Sistema Principal, Sistemas Externos)
//!   - Nivel 2: Contenedores (Unidades desplegables: Frontend, Backend, DB, etc.)
//!   - Nivel 3: Componentes (Módulos y sus dependencias internas)
//!   - Diagramas suplementarios (Dependencias Circulares, Paquetes, Herencia)

use std::collections::{HashMap, HashSet};

use crate::engine::amg::{
    Actor, Antipattern, AntipatternType, ArchStyle, C4DiagramData, C4Edge, C4Models, C4Node,
    Container, ContainerType, Dependency, ExternalCall, ExternalProtocol, ExternalSystem,
    ExternalSystemType, Language, Module, NodeType, ProjectType,
};

pub struct C4GeneratorOutput {
    pub actors: Vec<Actor>,
    pub external_systems: Vec<ExternalSystem>,
    pub containers: Vec<Container>,
    pub c4_models: C4Models,
}

pub struct C4Generator;

impl C4Generator {
    /// Genera la estructura completa de diagramas C4 y elementos inferidos.
    ///
    /// `antipatterns`: antipatrones ya detectados por el `Aggregator` (ver
    /// `detect_god_modules`/`detect_circular_dependencies`/
    /// `detect_layer_violations`), usados aquí para que el diagrama
    /// suplementario de dependencias circulares muestre EXACTAMENTE los
    /// mismos ciclos que la detección de antipatrones reportó — no una
    /// heurística separada. Ver `generate_circular_dependencies_diagram`.
    pub fn generate(
        project_name: &str,
        project_type: ProjectType,
        _detected_style: ArchStyle,
        modules: &[Module],
        dependencies: &[Dependency],
        raw_external_calls: &[ExternalCall],
        antipatterns: &[Antipattern],
    ) -> C4GeneratorOutput {
        // 1. Inferir Sistemas Externos desde las llamadas externas
        let external_systems = infer_external_systems(raw_external_calls);

        // 2. Inferir Actores desde los módulos/rutas del proyecto
        let actors = infer_actors(modules);

        // 3. Inferir Contenedores según el tipo de proyecto
        let containers = infer_containers(project_name, project_type, modules);

        // 4. Generar Nivel 1: Diagrama de Contexto
        let context_diagram = generate_context_diagram(project_name, &actors, &external_systems);

        // 5. Generar Nivel 2: Diagrama de Contenedores
        let container_diagram =
            generate_container_diagram(project_name, &actors, &containers, &external_systems);

        // 6. Generar Nivel 3: Diagrama de Componentes (por cada contenedor)
        let component_diagrams =
            generate_component_diagrams(&containers, modules, dependencies, antipatterns);

        let c4_models = C4Models {
            context_diagram,
            container_diagram,
            component_diagrams,
        };

        C4GeneratorOutput {
            actors,
            external_systems,
            containers,
            c4_models,
        }
    }

    /// Nivel 4 C4 (Diagrama de Código / Clases UML bajo demanda) — §4.4.4
    /// Transforma un módulo individual y sus `ClassInfo`/`FunctionInfo` en un
    /// subgrafo C4/UML de clases e interfaces.
    pub fn generate_module_code_diagram(module: &Module) -> C4DiagramData {
        generate_module_code_diagram(module)
    }
}

// ============================================================================
// Inferencia de Elementos
// ============================================================================

fn infer_external_systems(calls: &[ExternalCall]) -> Vec<ExternalSystem> {
    let mut systems_map: HashMap<String, ExternalProtocol> = HashMap::new();

    for call in calls {
        let sys_id = if call.external_system_id.is_empty() {
            "external-api".to_string()
        } else {
            call.external_system_id.clone()
        };

        systems_map
            .entry(sys_id)
            .or_insert(call.protocol);
    }

    // Si no hay llamadas registradas pero se detectó algo genérico, mantener seguro
    if systems_map.is_empty() {
        return Vec::new();
    }

    systems_map
        .into_iter()
        .map(|(sys_id, protocol)| {
            let is_db = sys_id.contains("db")
                || sys_id.contains("sql")
                || matches!(protocol, ExternalProtocol::Jdbc);
            let system_type = if is_db {
                ExternalSystemType::Database
            } else {
                ExternalSystemType::Api
            };

            let name = match sys_id.as_str() {
                "http-api" => "External HTTP Service".to_string(),
                "database" => "Database Storage".to_string(),
                other => format!("External {}", other),
            };

            ExternalSystem {
                id: format!("ext:{}", sys_id),
                node_type: NodeType::ExternalSystem,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name,
                description: "External dependency service integrated via API or connection"
                    .to_string(),
                system_type,
                protocol,
                detected_via: "AST ExternalCall Analysis".to_string(),
            }
        })
        .collect()
}

fn infer_actors(modules: &[Module]) -> Vec<Actor> {
    let has_admin = modules.iter().any(|m| {
        let path_lower = m.id.to_lowercase();
        path_lower.contains("admin")
    });

    if has_admin {
        vec![
            Actor {
                id: "actor:admin".to_string(),
                node_type: NodeType::Actor,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: "Admin User".to_string(),
                role: "Administrator".to_string(),
                description: "User with administrative management privileges".to_string(),
            },
            Actor {
                id: "actor:user".to_string(),
                node_type: NodeType::Actor,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: "Public User".to_string(),
                role: "End User".to_string(),
                description: "Standard end user accessing public features".to_string(),
            },
        ]
    } else {
        vec![Actor {
            id: "actor:user".to_string(),
            node_type: NodeType::Actor,
            stable_since: String::new(),
            last_seen_in: String::new(),
            name: "User".to_string(),
            role: "User".to_string(),
            description: "Application user".to_string(),
        }]
    }
}

fn infer_containers(
    project_name: &str,
    project_type: ProjectType,
    modules: &[Module],
) -> Vec<Container> {
    let module_ids: Vec<String> = modules.iter().map(|m| m.id.clone()).collect();
    let dominant_lang = get_dominant_language(modules);

    match project_type {
        ProjectType::Desktop => vec![
            Container {
                id: "container:frontend".to_string(),
                node_type: NodeType::Container,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: "Desktop Frontend".to_string(),
                technology: "React / HTML / TypeScript".to_string(),
                container_type: ContainerType::Spa,
                description: "User interface rendered inside webview window".to_string(),
                module_ids: Vec::new(),
                detected_from: "Desktop App Project Structure".to_string(),
            },
            Container {
                id: "container:backend".to_string(),
                node_type: NodeType::Container,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: format!("{} Core Engine", project_name),
                technology: format!("Rust / Tauri ({})", dominant_lang),
                container_type: ContainerType::DesktopApp,
                description: "Desktop core backend process, file storage and AST engines"
                    .to_string(),
                module_ids,
                detected_from: "src-tauri / Rust Cargo".to_string(),
            },
        ],
        ProjectType::Web | ProjectType::Server => vec![
            Container {
                id: "container:web-frontend".to_string(),
                node_type: NodeType::Container,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: "Web SPA Client".to_string(),
                technology: "TypeScript / React / Browser".to_string(),
                container_type: ContainerType::Spa,
                description: "Client-side Single Page Application".to_string(),
                module_ids: Vec::new(),
                detected_from: "Frontend Web Modules".to_string(),
            },
            Container {
                id: "container:api-server".to_string(),
                node_type: NodeType::Container,
                stable_since: String::new(),
                last_seen_in: String::new(),
                name: format!("{} API Server", project_name),
                technology: dominant_lang,
                container_type: ContainerType::Api,
                description: "Backend REST/gRPC API Application Server".to_string(),
                module_ids,
                detected_from: "Backend Source Tree".to_string(),
            },
        ],
        _ => vec![Container {
            id: "container:app".to_string(),
            node_type: NodeType::Container,
            stable_since: String::new(),
            last_seen_in: String::new(),
            name: format!("{} Application", project_name),
            technology: dominant_lang,
            container_type: ContainerType::Other,
            description: "Main application container".to_string(),
            module_ids,
            detected_from: "Application Directory".to_string(),
        }],
    }
}

// ============================================================================
// Generadores de Diagramas C4
// ============================================================================

fn generate_context_diagram(
    project_name: &str,
    actors: &[Actor],
    external_systems: &[ExternalSystem],
) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let main_sys_id = "system:main";

    // Nodo central
    nodes.push(C4Node {
        id: main_sys_id.to_string(),
        label: project_name.to_string(),
        element_type: "Software System".to_string(),
        technology: "Multi-language Software Project".to_string(),
        description: format!("Main system under architecture analysis ({})", project_name),
        amg_node_id: None,
    });

    // Nodos de Actores y relaciones
    for actor in actors {
        nodes.push(C4Node {
            id: actor.id.clone(),
            label: actor.name.clone(),
            element_type: "Person".to_string(),
            technology: "User".to_string(),
            description: actor.description.clone(),
            amg_node_id: None,
        });

        edges.push(C4Edge {
            source: actor.id.clone(),
            target: main_sys_id.to_string(),
            label: "Uses / Operates".to_string(),
            protocol: Some("UI / CLI".to_string()),
        });
    }

    // Nodos de Sistemas Externos y relaciones
    for sys in external_systems {
        nodes.push(C4Node {
            id: sys.id.clone(),
            label: sys.name.clone(),
            element_type: "External System".to_string(),
            technology: format!("{:?}", sys.protocol),
            description: sys.description.clone(),
            amg_node_id: None,
        });

        edges.push(C4Edge {
            source: main_sys_id.to_string(),
            target: sys.id.clone(),
            label: "Integrates with".to_string(),
            protocol: Some(format!("{:?}", sys.protocol)),
        });
    }

    C4DiagramData { nodes, edges }
}

fn generate_container_diagram(
    _project_name: &str,
    actors: &[Actor],
    containers: &[Container],
    external_systems: &[ExternalSystem],
) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    // Actores
    for actor in actors {
        nodes.push(C4Node {
            id: actor.id.clone(),
            label: actor.name.clone(),
            element_type: "Person".to_string(),
            technology: String::new(),
            description: actor.description.clone(),
            amg_node_id: None,
        });
    }

    // Contenedores
    for c in containers {
        nodes.push(C4Node {
            id: c.id.clone(),
            label: c.name.clone(),
            element_type: "Container".to_string(),
            technology: c.technology.clone(),
            description: c.description.clone(),
            amg_node_id: None,
        });
    }

    // Sistemas Externos
    for sys in external_systems {
        nodes.push(C4Node {
            id: sys.id.clone(),
            label: sys.name.clone(),
            element_type: "External System".to_string(),
            technology: format!("{:?}", sys.protocol),
            description: sys.description.clone(),
            amg_node_id: None,
        });
    }

    // Relaciones entre Actores y primer contenedor (Frontend o App principal)
    let primary_container = containers
        .first()
        .map(|c| c.id.as_str())
        .unwrap_or("container:backend");

    for actor in actors {
        edges.push(C4Edge {
            source: actor.id.clone(),
            target: primary_container.to_string(),
            label: "Interacts with".to_string(),
            protocol: Some("GUI / Web".to_string()),
        });
    }

    // Si hay Frontend y Backend separados
    if containers.len() >= 2 {
        edges.push(C4Edge {
            source: containers[0].id.clone(),
            target: containers[1].id.clone(),
            label: "IPC / API Calls".to_string(),
            protocol: Some("Tauri IPC / REST".to_string()),
        });
    }

    // Relaciones Backend / Contenedores hacia Sistemas Externos
    let backend_container = containers
        .last()
        .map(|c| c.id.as_str())
        .unwrap_or(primary_container);

    for sys in external_systems {
        edges.push(C4Edge {
            source: backend_container.to_string(),
            target: sys.id.clone(),
            label: "Sends data / Queries".to_string(),
            protocol: Some(format!("{:?}", sys.protocol)),
        });
    }

    C4DiagramData { nodes, edges }
}

fn generate_component_diagrams(
    containers: &[Container],
    modules: &[Module],
    dependencies: &[Dependency],
    antipatterns: &[Antipattern],
) -> HashMap<String, C4DiagramData> {
    let mut map = HashMap::new();

    let module_map: HashMap<&str, &Module> = modules.iter().map(|m| (m.id.as_str(), m)).collect();

    for container in containers {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        let target_ids: HashSet<&str> = if container.module_ids.is_empty() {
            // Si el contenedor no especifica módulos, asigna todos
            modules.iter().map(|m| m.id.as_str()).collect()
        } else {
            container.module_ids.iter().map(|id| id.as_str()).collect()
        };

        for &mod_id in &target_ids {
            if let Some(m) = module_map.get(mod_id) {
                nodes.push(C4Node {
                    id: m.id.clone(),
                    label: m.name.clone(),
                    element_type: "Component".to_string(),
                    technology: format!("{:?}", m.language),
                    description: format!(
                        "Module (LOC: {}, LLOC: {}, Ce: {})",
                        m.loc, m.lloc, m.metrics.ce
                    ),
                    amg_node_id: Some(m.id.clone()),
                });
            }
        }

        for dep in dependencies {
            if target_ids.contains(dep.source.as_str())
                && target_ids.contains(dep.target.as_str())
            {
                edges.push(C4Edge {
                    source: dep.source.clone(),
                    target: dep.target.clone(),
                    label: "depends on".to_string(),
                    protocol: None,
                });
            }
        }

        map.insert(container.id.clone(), C4DiagramData { nodes, edges });
    }

    // Añadir diagrama suplementario de dependencias circulares, construido
    // desde los antipatrones REALES ya detectados (ver docstring de
    // `generate_circular_dependencies_diagram`).
    let circular_diagram = generate_circular_dependencies_diagram(modules, antipatterns);
    map.insert("supplementary:circular-dependencies".to_string(), circular_diagram);

    map
}

/// Diagrama suplementario: muestra únicamente el subgrafo de dependencias
/// circulares, construido a partir de los `Antipattern` de tipo
/// `CircularDependency` YA DETECTADOS por `detect_circular_dependencies`
/// (Tarjan + DFS) en el `Aggregator`.
///
/// ANTES: esta función recalculaba "candidatos a ciclo" con su propia
/// heurística (`m.metrics.ce > 0 && m.metrics.ca > 0` — tener tanto
/// dependencias salientes como entrantes). Esa condición es NECESARIA
/// pero NO SUFICIENTE para participar en un ciclo real: un módulo con
/// Ce=3, Ca=2 puede pertenecer a un grafo denso pero completamente
/// acíclico. El resultado podía mostrar en este diagrama módulos que la
/// detección de antipatrones ni siquiera reportaba como cíclicos,
/// desincronizando la vista suplementaria del resto del análisis.
///
/// AHORA: se usa directamente `antipattern.cycle_path` (la secuencia
/// exacta de módulos que Tarjan+DFS identificó cerrando un ciclo real) —
/// la unión de todos los `cycle_path` de todos los antipatrones
/// `CircularDependency` define exactamente qué nodos y aristas aparecen
/// aquí, sin heurísticas adicionales ni posibilidad de desacuerdo con la
/// lista de antipatrones que ve el usuario en otra parte de la UI.
fn generate_circular_dependencies_diagram(
    modules: &[Module],
    antipatterns: &[Antipattern],
) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let module_map: HashMap<&str, &Module> = modules.iter().map(|m| (m.id.as_str(), m)).collect();

    // Unión de todos los módulos que aparecen en CUALQUIER cycle_path real.
    let mut cyclic_modules: HashSet<&str> = HashSet::new();
    // Unión de las aristas consecutivas de cada cycle_path (incluyendo el
    // cierre del ciclo: último nodo -> primer nodo).
    let mut cyclic_edges: HashSet<(String, String)> = HashSet::new();

    for ap in antipatterns {
        if ap.antipattern_type != AntipatternType::CircularDependency {
            continue;
        }
        let Some(cycle) = &ap.cycle_path else { continue };
        if cycle.len() < 2 {
            continue;
        }

        for id in cycle {
            cyclic_modules.insert(id.as_str());
        }

        for window in cycle.windows(2) {
            cyclic_edges.insert((window[0].clone(), window[1].clone()));
        }
        // Cierre del ciclo: el `cycle_path` normalizado no repite el nodo
        // inicial al final (ver `detect_circular_dependencies`), así que la
        // arista que cierra el ciclo (último -> primero) se añade aparte.
        if let (Some(last), Some(first)) = (cycle.last(), cycle.first()) {
            cyclic_edges.insert((last.clone(), first.clone()));
        }
    }

    for &mod_id in &cyclic_modules {
        if let Some(m) = module_map.get(mod_id) {
            nodes.push(C4Node {
                id: m.id.clone(),
                label: m.name.clone(),
                element_type: "Component (Cyclic)".to_string(),
                technology: format!("{:?}", m.language),
                description: format!(
                    "Module participating in a detected circular dependency (Ce: {}, Ca: {})",
                    m.metrics.ce, m.metrics.ca
                ),
                amg_node_id: Some(m.id.clone()),
            });
        }
    }

    for (source, target) in cyclic_edges {
        edges.push(C4Edge {
            source,
            target,
            label: "cyclic dependency".to_string(),
            protocol: None,
        });
    }

    C4DiagramData { nodes, edges }
}

fn get_dominant_language(modules: &[Module]) -> String {
    let mut counts: HashMap<Language, usize> = HashMap::new();
    for m in modules {
        *counts.entry(m.language).or_insert(0) += 1;
    }

    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(lang, _)| format!("{:?}", lang))
        .unwrap_or_else(|| "Multi-language".to_string())
}

/// Nivel 4 C4 (Diagrama de Código / Clases UML bajo demanda) — §4.4.4
/// Transforma un módulo individual y sus `ClassInfo`/`FunctionInfo` en un
/// subgrafo C4/UML de clases e interfaces.
fn generate_module_code_diagram(module: &Module) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let mut class_node_ids: HashMap<String, String> = HashMap::new();

    for cls in &module.classes {
        let node_id = if cls.id.is_empty() {
            format!("{}:class:{}", module.id, cls.name)
        } else {
            cls.id.clone()
        };

        class_node_ids.insert(cls.name.clone(), node_id.clone());

        let element_type = if cls.is_interface {
            "Interface".to_string()
        } else if cls.is_abstract {
            "Abstract Class".to_string()
        } else {
            "Class".to_string()
        };

        let method_summary = if cls.methods.is_empty() {
            "No methods".to_string()
        } else {
            format!("{} methods", cls.methods.len())
        };

        let attr_summary = if cls.attributes.is_empty() {
            "No fields".to_string()
        } else {
            format!("{} fields", cls.attributes.len())
        };

        nodes.push(C4Node {
            id: node_id,
            label: cls.name.clone(),
            element_type,
            technology: format!("{:?}", module.language),
            description: format!("{}, {}", attr_summary, method_summary),
            amg_node_id: Some(module.id.clone()),
        });
    }

    for func in &module.functions {
        let node_id = if func.id.is_empty() {
            format!("{}:func:{}", module.id, func.name)
        } else {
            func.id.clone()
        };

        nodes.push(C4Node {
            id: node_id,
            label: format!("{}()", func.name),
            element_type: "Function".to_string(),
            technology: format!("{:?}", module.language),
            description: format!("Standalone Function (LOC: {})", func.loc),
            amg_node_id: Some(module.id.clone()),
        });
    }

    for cls in &module.classes {
        let src_id = class_node_ids
            .get(&cls.name)
            .cloned()
            .unwrap_or_else(|| format!("{}:class:{}", module.id, cls.name));

        for parent_name in &cls.extends {
            if let Some(target_id) = class_node_ids.get(parent_name) {
                edges.push(C4Edge {
                    source: src_id.clone(),
                    target: target_id.clone(),
                    label: "extends".to_string(),
                    protocol: None,
                });
            }
        }

        for iface_name in &cls.implements {
            if let Some(target_id) = class_node_ids.get(iface_name) {
                edges.push(C4Edge {
                    source: src_id.clone(),
                    target: target_id.clone(),
                    label: "implements".to_string(),
                    protocol: None,
                });
            }
        }
    }

    C4DiagramData { nodes, edges }
}