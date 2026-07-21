//! supplementary_diagrams.rs — Generador de Diagramas Suplementarios Adicionales.
//!
//! §4.4.5 de la especificación técnica SAAC: genera vistas suplementarias avanzadas:
//!   - Diagrama de Paquetes (Package Diagram, UML)
//!   - Árbol de Herencia Global (Inheritance Tree)
//!   - Diagrama Entidad-Relación (ER Diagram)

use std::collections::{HashMap, HashSet};

use crate::engine::amg::{
    C4DiagramData, C4Edge, C4Node, Dependency, Module, ModuleType,
};

pub struct SupplementaryDiagrams;

impl SupplementaryDiagrams {
    /// Genera todos los diagramas suplementarios adicionales soportados por el backend.
    pub fn generate_all(
        modules: &[Module],
        dependencies: &[Dependency],
    ) -> HashMap<String, C4DiagramData> {
        let mut diagrams = HashMap::new();

        diagrams.insert(
            "supplementary:package-diagram".to_string(),
            generate_package_diagram(modules, dependencies),
        );

        diagrams.insert(
            "supplementary:inheritance-tree".to_string(),
            generate_inheritance_tree(modules),
        );

        diagrams.insert(
            "supplementary:er-diagram".to_string(),
            generate_er_diagram(modules),
        );

        diagrams
    }
}

// ============================================================================
// 1. Diagrama de Paquetes (Package Diagram, UML)
// ============================================================================

fn generate_package_diagram(
    modules: &[Module],
    dependencies: &[Dependency],
) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    // Mapear cada módulo a su paquete/directorio contenedor
    let mut pkg_by_module: HashMap<String, String> = HashMap::new();
    let mut pkg_metrics: HashMap<String, (u32, u32)> = HashMap::new(); // pkg -> (mod_count, total_loc)

    for m in modules {
        let pkg_name = extract_package_name(&m.id);
        pkg_by_module.insert(m.id.clone(), pkg_name.clone());

        let entry = pkg_metrics.entry(pkg_name).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += m.loc;
    }

    // Nodos de paquetes
    for (pkg_name, (mod_count, total_loc)) in &pkg_metrics {
        nodes.push(C4Node {
            id: format!("pkg:{}", pkg_name),
            label: pkg_name.clone(),
            element_type: "Package".to_string(),
            technology: "Package / Namespace".to_string(),
            description: format!("Contains {} modules (Total LOC: {})", mod_count, total_loc),
            amg_node_id: None,
        });
    }

    // Aristas agregadas entre paquetes
    let mut pkg_deps: HashMap<(String, String), u32> = HashMap::new();

    for dep in dependencies {
        let src_pkg = pkg_by_module.get(&dep.source);
        let tgt_pkg = pkg_by_module.get(&dep.target);

        if let (Some(sp), Some(tp)) = (src_pkg, tgt_pkg) {
            if sp != tp {
                *pkg_deps.entry((sp.clone(), tp.clone())).or_insert(0) += 1;
            }
        }
    }

    for ((src_pkg, tgt_pkg), count) in pkg_deps {
        edges.push(C4Edge {
            source: format!("pkg:{}", src_pkg),
            target: format!("pkg:{}", tgt_pkg),
            label: format!("{} imports", count),
            protocol: None,
        });
    }

    C4DiagramData { nodes, edges }
}

/// Extrae el "paquete" (directorio contenedor completo) de un `module_id`.
///
/// ANTES: tomaba solo el PENÚLTIMO segmento del path
/// (`parts[parts.len() - 2]`). Esto funciona para rutas de un solo nivel
/// (`services/user_service` → `services`), pero da resultados incorrectos
/// con anidamiento de 2+ niveles: `services/billing/invoice_service` daba
/// `billing` y `services/shipping/tracking_service` daba `shipping` — dos
/// paquetes que PARECEN no tener relación entre sí, cuando en realidad son
/// sub-paquetes hermanos bajo `services/`. El diagrama perdía justamente
/// la agrupación jerárquica que es su propósito.
///
/// AHORA: se une TODA la ruta de directorio (todos los segmentos menos el
/// último, que es el nombre de archivo), preservando la jerarquía completa
/// como identificador de paquete (`services/billing`, `services/shipping`).
fn extract_package_name(module_id: &str) -> String {
    let parts: Vec<&str> = module_id.split('/').collect();
    if parts.len() > 1 {
        parts[..parts.len() - 1].join("/")
    } else {
        "root".to_string()
    }
}

// ============================================================================
// 2. Árbol de Herencia Global (Inheritance Tree)
// ============================================================================

fn generate_inheritance_tree(modules: &[Module]) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    // Mapear nombre de clase -> (id del nodo C4, módulo contenedor)
    let mut class_map: HashMap<String, (String, String)> = HashMap::new();

    for m in modules {
        for cls in &m.classes {
            let node_id = if cls.id.is_empty() {
                format!("{}:class:{}", m.id, cls.name)
            } else {
                cls.id.clone()
            };

            class_map.insert(cls.name.clone(), (node_id.clone(), m.id.clone()));

            let element_type = if cls.is_interface {
                "Interface".to_string()
            } else if cls.is_abstract {
                "Abstract Class".to_string()
            } else {
                "Class".to_string()
            };

            nodes.push(C4Node {
                id: node_id,
                label: cls.name.clone(),
                element_type,
                technology: format!("{:?}", m.language),
                description: format!(
                    "Fields: {}, Methods: {}",
                    cls.attributes.len(),
                    cls.methods.len()
                ),
                amg_node_id: Some(m.id.clone()),
            });
        }
    }

    // Conectar herencia e implementación a nivel de todo el proyecto
    for m in modules {
        for cls in &m.classes {
            let src_node_id = class_map
                .get(&cls.name)
                .map(|(id, _)| id.clone())
                .unwrap_or_else(|| format!("{}:class:{}", m.id, cls.name));

            for parent_name in &cls.extends {
                if let Some((tgt_node_id, _)) = class_map.get(parent_name) {
                    edges.push(C4Edge {
                        source: src_node_id.clone(),
                        target: tgt_node_id.clone(),
                        label: "extends".to_string(),
                        protocol: None,
                    });
                }
            }

            for iface_name in &cls.implements {
                if let Some((tgt_node_id, _)) = class_map.get(iface_name) {
                    edges.push(C4Edge {
                        source: src_node_id.clone(),
                        target: tgt_node_id.clone(),
                        label: "implements".to_string(),
                        protocol: None,
                    });
                }
            }
        }
    }

    C4DiagramData { nodes, edges }
}

// ============================================================================
// 3. Diagrama Entidad-Relación (ER Diagram)
// ============================================================================

fn generate_er_diagram(modules: &[Module]) -> C4DiagramData {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let mut entity_map: HashMap<String, (String, HashSet<String>)> = HashMap::new(); // class_name -> (node_id, attr_types)

    for m in modules {
        let is_model_module = m.module_type == ModuleType::Model
            || m.id.to_lowercase().contains("model")
            || m.id.to_lowercase().contains("entity")
            || m.id.to_lowercase().contains("domain");

        if is_model_module {
            for cls in &m.classes {
                let node_id = format!("entity:{}", cls.name);
                let attr_names: Vec<String> = cls
                    .attributes
                    .iter()
                    .map(|a| format!("{}: {}", a.name, a.type_name))
                    .collect();

                let attr_types: HashSet<String> = cls
                    .attributes
                    .iter()
                    .map(|a| a.type_name.clone())
                    .collect();

                nodes.push(C4Node {
                    id: node_id.clone(),
                    label: cls.name.clone(),
                    element_type: "Entity".to_string(),
                    technology: "Database / Domain Entity".to_string(),
                    description: format!("Attributes: {}", attr_names.join(", ")),
                    amg_node_id: Some(m.id.clone()),
                });

                entity_map.insert(cls.name.clone(), (node_id, attr_types));
            }
        }
    }

    // Relaciones entre entidades.
    //
    // LIMITACIÓN CONOCIDA: la detección compara el nombre completo del tipo
    // de un atributo (`attr_types`, ej. "User") contra los nombres de
    // entidad conocidos. Esto pierde relaciones expresadas como colecciones
    // o wrappers genéricos — `List<User>`, `Optional<User>`, `User[]`,
    // `Vec<User>` — porque el string completo del tipo no coincide
    // exactamente con el nombre de la entidad ("List<User>" != "User").
    // Detectar esos casos requeriría parsing de genéricos específico por
    // lenguaje (la sintaxis de colección difiere entre Java/TS/Python/Rust),
    // que queda pendiente como mejora futura si se confirma que el impacto
    // es significativo en proyectos reales.
    let entity_names: HashSet<String> = entity_map.keys().cloned().collect();

    for (entity_name, (src_node_id, attr_types)) in &entity_map {
        for target_name in &entity_names {
            if target_name != entity_name && attr_types.contains(target_name) {
                edges.push(C4Edge {
                    source: src_node_id.clone(),
                    target: entity_map[target_name].0.clone(),
                    label: "references".to_string(),
                    protocol: Some("FK / Association".to_string()),
                });
            }
        }
    }

    C4DiagramData { nodes, edges }
}