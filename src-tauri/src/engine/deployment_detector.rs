//! deployment_detector.rs — Detector de Infraestructura y Despliegue.
//!
//! Escanea el repositorio en busca de manifiestos de infraestructura
//! (`docker-compose.yml`, `Dockerfile`, manifiestos Kubernetes, `fly.toml`, `Procfile`)
//! y genera el Diagrama de Despliegue (Deployment Diagram).

use std::fs;
use std::path::Path;
use crate::engine::amg::{C4DiagramData, C4Edge, C4Node, Container, ExternalSystem};

pub struct DeploymentDetector;

impl DeploymentDetector {
    /// Infiere o escanea la infraestructura del proyecto para construir el Diagrama de Despliegue.
    pub fn detect_and_generate(
        project_path: &Path,
        containers: &[Container],
        external_systems: &[ExternalSystem],
    ) -> C4DiagramData {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        let compose_path_yml = project_path.join("docker-compose.yml");
        let compose_path_yaml = project_path.join("docker-compose.yaml");
        let compose_alt = project_path.join("compose.yml");

        let compose_file = if compose_path_yml.exists() {
            Some(compose_path_yml)
        } else if compose_path_yaml.exists() {
            Some(compose_path_yaml)
        } else if compose_alt.exists() {
            Some(compose_alt)
        } else {
            None
        };

        if let Some(cfile) = compose_file {
            if let Ok(content) = fs::read_to_string(&cfile) {
                let parsed = parse_docker_compose(&content);
                for node in parsed.0 {
                    nodes.push(node);
                }
                for edge in parsed.1 {
                    edges.push(edge);
                }
            }
        }

        // Si no hay docker-compose o dio vacío, inferir despliegue a partir de contenedores y sistemas externos
        if nodes.is_empty() {
            // Nodo de Servidor / Host
            let host_id = "deploy:host".to_string();
            nodes.push(C4Node {
                id: host_id.clone(),
                label: "Host Environment / Node".to_string(),
                element_type: "Deployment Node".to_string(),
                technology: "Operating System / Server Host".to_string(),
                description: "Local or Cloud host running application containers".to_string(),
                amg_node_id: None,
            });

            for c in containers {
                let c_node_id = format!("deploy:container:{}", c.id);
                nodes.push(C4Node {
                    id: c_node_id.clone(),
                    label: c.name.clone(),
                    element_type: "Container Instance".to_string(),
                    technology: c.technology.clone(),
                    description: format!("Deployment instance for {}", c.name),
                    amg_node_id: Some(c.id.clone()),
                });

                edges.push(C4Edge {
                    source: host_id.clone(),
                    target: c_node_id.clone(),
                    label: "hosts".to_string(),
                    protocol: Some("Process / Runtime".to_string()),
                });
            }

            for ext in external_systems {
                let ext_node_id = format!("deploy:ext:{}", ext.id);
                nodes.push(C4Node {
                    id: ext_node_id.clone(),
                    label: ext.name.clone(),
                    element_type: "Infrastructure Node".to_string(),
                    technology: format!("{:?}", ext.protocol),
                    description: ext.description.clone(),
                    amg_node_id: Some(ext.id.clone()),
                });

                // Conectar contenedores a sistemas externos
                for c in containers {
                    edges.push(C4Edge {
                        source: format!("deploy:container:{}", c.id),
                        target: ext_node_id.clone(),
                        label: "connects to".to_string(),
                        protocol: Some(format!("{:?}", ext.protocol)),
                    });
                }
            }
        }

        C4DiagramData { nodes, edges }
    }
}

/// Parsea de forma liviana un archivo docker-compose simple para extraer servicios e interconexiones.
fn parse_docker_compose(content: &str) -> (Vec<C4Node>, Vec<C4Edge>) {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let mut current_service: Option<String> = None;
    let mut current_image: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }

        // Detección simple de nombres de servicio bajo `services:`
        if line.starts_with("  ") && !line.starts_with("    ") && trimmed.ends_with(':') && !trimmed.starts_with("version") && !trimmed.starts_with("services") && !trimmed.starts_with("networks") && !trimmed.starts_with("volumes") {
            let service_name = trimmed.trim_end_matches(':').to_string();
            
            if let Some(prev) = current_service.take() {
                nodes.push(C4Node {
                    id: format!("docker:{}", prev),
                    label: prev.clone(),
                    element_type: "Docker Container".to_string(),
                    technology: current_image.take().unwrap_or_else(|| "Docker Service".to_string()),
                    description: format!("Docker compose service '{}'", prev),
                    amg_node_id: None,
                });
            }
            current_service = Some(service_name);
        } else if trimmed.starts_with("image:") {
            current_image = Some(trimmed.trim_start_matches("image:").trim().to_string());
        } else if trimmed.starts_with("- ") && line.contains("depends_on") {
            if let Some(ref src) = current_service {
                let dep_tgt = trimmed.trim_start_matches("- ").trim();
                edges.push(C4Edge {
                    source: format!("docker:{}", src),
                    target: format!("docker:{}", dep_tgt),
                    label: "depends on".to_string(),
                    protocol: Some("Docker Network".to_string()),
                });
            }
        }
    }

    if let Some(last_svc) = current_service {
        nodes.push(C4Node {
            id: format!("docker:{}", last_svc),
            label: last_svc.clone(),
            element_type: "Docker Container".to_string(),
            technology: current_image.unwrap_or_else(|| "Docker Service".to_string()),
            description: format!("Docker compose service '{}'", last_svc),
            amg_node_id: None,
        });
    }

    (nodes, edges)
}
