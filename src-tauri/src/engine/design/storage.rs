use super::model::{
    CanvasLayout, DesignIndex, DesignSnapshot, NodeOrigin, NodePosition, ProposedArchitecture,
    ProposedArchitectureSummary, ProposedEdge, ProposedNode, DESIGN_SCHEMA_VERSION,
};
use crate::engine::amg::{ArchitectureModelGraph, EdgeType, NodeType};
use crate::engine::history::HistoryManager;
use chrono::Utc;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum DesignError {
    #[error("La ruta del proyecto no existe o no es un directorio: {0}")]
    InvalidProjectPath(String),
    #[error("ID de diseño inválido: {0}")]
    InvalidDesignId(String),
    #[error("Diseño no encontrado: {0}")]
    NotFound(String),
    #[error(
        "Conflicto de revisión para '{design_id}': se esperaba {expected}, se recibió {actual}"
    )]
    RevisionConflict {
        design_id: String,
        expected: u64,
        actual: u64,
    },
    #[error("El diseño no pertenece al proyecto actual")]
    ProjectMismatch,
    #[error("Grafo de diseño inválido: {0}")]
    InvalidGraph(String),
    #[error("No se encontró el AMG de la corrida base '{0}'")]
    BaseRunNotFound(String),
    #[error("Error de E/S en '{path}': {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("JSON inválido en '{path}': {source}")]
    Json {
        path: String,
        #[source]
        source: serde_json::Error,
    },
}

pub struct DesignManager;

impl DesignManager {
    pub fn create(
        project_path: &str,
        name: String,
        description: Option<String>,
        base: Option<&ArchitectureModelGraph>,
    ) -> Result<ProposedArchitecture, DesignError> {
        let project_root = canonical_project_root(project_path)?;
        let now = Utc::now().to_rfc3339();
        let id = format!("design_{}", Uuid::new_v4());
        let project_id = base
            .map(|amg| amg.project_id.clone())
            .unwrap_or_else(|| project_id_for_project(project_path));
        let based_on_analysis_run_id = base.map(|amg| amg.analysis_run_id.clone());
        let (nodes, edges) = base.map(import_graph).unwrap_or_default();

        let architecture = ProposedArchitecture {
            schema_version: DESIGN_SCHEMA_VERSION,
            id,
            project_id,
            name,
            description,
            based_on_analysis_run_id,
            created_at: now.clone(),
            updated_at: now,
            revision: 1,
            nodes,
            edges,
            canvas_layout: CanvasLayout::default(),
        };

        validate_architecture(&architecture)?;
        let dir = designs_dir(&project_root);
        create_dir_all(&dir)?;
        write_json_atomic(&design_path(&dir, &architecture.id), &architecture)?;
        upsert_index(&dir, &architecture)?;
        Ok(architecture)
    }

    pub fn list(project_path: &str) -> Result<Vec<ProposedArchitectureSummary>, DesignError> {
        let project_root = canonical_project_root(project_path)?;
        let dir = designs_dir(&project_root);
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut index = load_or_rebuild_index(&dir)?;
        index.designs.sort_by(|a, b| {
            b.updated_at
                .cmp(&a.updated_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(index.designs)
    }

    pub fn load(project_path: &str, design_id: &str) -> Result<ProposedArchitecture, DesignError> {
        validate_design_id(design_id)?;
        let project_root = canonical_project_root(project_path)?;
        let path = design_path(&designs_dir(&project_root), design_id);
        if !path.is_file() {
            return Err(DesignError::NotFound(design_id.to_string()));
        }
        let architecture: ProposedArchitecture = read_json(&path)?;
        if architecture.id != design_id {
            return Err(DesignError::InvalidGraph(format!(
                "el ID interno '{}' no coincide con el archivo '{}'",
                architecture.id, design_id
            )));
        }
        validate_architecture(&architecture)?;
        Ok(architecture)
    }

    pub fn update(
        project_path: &str,
        design_id: &str,
        mut architecture: ProposedArchitecture,
    ) -> Result<ProposedArchitecture, DesignError> {
        validate_design_id(design_id)?;
        let stored = Self::load(project_path, design_id)?;

        if architecture.id != design_id {
            return Err(DesignError::InvalidGraph(
                "el ID del payload no coincide con designId".to_string(),
            ));
        }
        if architecture.schema_version != DESIGN_SCHEMA_VERSION {
            return Err(DesignError::InvalidGraph(format!(
                "schemaVersion no soportado: {}",
                architecture.schema_version
            )));
        }
        if architecture.project_id != stored.project_id {
            return Err(DesignError::ProjectMismatch);
        }
        if architecture.created_at != stored.created_at
            || architecture.based_on_analysis_run_id != stored.based_on_analysis_run_id
        {
            return Err(DesignError::InvalidGraph(
                "createdAt y basedOnAnalysisRunId son inmutables".to_string(),
            ));
        }
        if architecture.revision != stored.revision {
            return Err(DesignError::RevisionConflict {
                design_id: design_id.to_string(),
                expected: stored.revision,
                actual: architecture.revision,
            });
        }

        architecture.schema_version = DESIGN_SCHEMA_VERSION;
        architecture.revision = stored.revision + 1;
        architecture.updated_at = Utc::now().to_rfc3339();
        recalculate_modified(project_path, &mut architecture)?;
        validate_architecture(&architecture)?;

        let project_root = canonical_project_root(project_path)?;
        let dir = designs_dir(&project_root);
        let snapshot = DesignSnapshot {
            id: format!("snapshot_{:010}", architecture.revision),
            design_id: architecture.id.clone(),
            revision: architecture.revision,
            created_at: architecture.updated_at.clone(),
            architecture: architecture.clone(),
        };
        let snapshots = snapshots_dir(&dir, design_id);
        create_dir_all(&snapshots)?;
        write_json_atomic(
            &snapshots.join(format!("snapshot_{:010}.json", architecture.revision)),
            &snapshot,
        )?;
        write_json_atomic(&design_path(&dir, design_id), &architecture)?;
        upsert_index(&dir, &architecture)?;
        Ok(architecture)
    }

    pub fn add_proposed_node(
        project_path: &str,
        design_id: &str,
        node_type: NodeType,
        label: String,
        position: NodePosition,
    ) -> Result<ProposedNode, DesignError> {
        if !is_design_node_type(node_type) {
            return Err(DesignError::InvalidGraph(
                "solo se admiten módulos, contenedores, sistemas externos y actores".to_string(),
            ));
        }
        let mut architecture = Self::load(project_path, design_id)?;
        let node = ProposedNode {
            id: format!("prop_{}", Uuid::new_v4()),
            origin: NodeOrigin::Proposed,
            original_node_id: None,
            node_type,
            label,
            modified: false,
            properties: Map::new(),
            position,
        };
        architecture.nodes.push(node.clone());
        Self::update(project_path, design_id, architecture)?;
        Ok(node)
    }

    pub fn delete(project_path: &str, design_id: &str) -> Result<(), DesignError> {
        validate_design_id(design_id)?;
        let project_root = canonical_project_root(project_path)?;
        let dir = designs_dir(&project_root);
        let path = design_path(&dir, design_id);
        if !path.is_file() {
            return Err(DesignError::NotFound(design_id.to_string()));
        }
        remove_file(&path)?;
        let snapshots = snapshots_dir(&dir, design_id);
        if snapshots.exists() {
            fs::remove_dir_all(&snapshots).map_err(|source| DesignError::Io {
                path: snapshots.display().to_string(),
                source,
            })?;
        }

        let mut index = load_or_rebuild_index(&dir)?;
        index.designs.retain(|summary| summary.id != design_id);
        write_json_atomic(&index_path(&dir), &index)?;
        Ok(())
    }

    pub fn list_snapshots(
        project_path: &str,
        design_id: &str,
    ) -> Result<Vec<DesignSnapshot>, DesignError> {
        validate_design_id(design_id)?;
        let project_root = canonical_project_root(project_path)?;
        let dir = snapshots_dir(&designs_dir(&project_root), design_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut snapshots = Vec::new();
        for entry in fs::read_dir(&dir).map_err(|source| DesignError::Io {
            path: dir.display().to_string(),
            source,
        })? {
            let entry = entry.map_err(|source| DesignError::Io {
                path: dir.display().to_string(),
                source,
            })?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) == Some("json") {
                snapshots.push(read_json(&path)?);
            }
        }
        snapshots.sort_by_key(|snapshot: &DesignSnapshot| snapshot.revision);
        Ok(snapshots)
    }
}

pub(crate) fn import_graph(amg: &ArchitectureModelGraph) -> (Vec<ProposedNode>, Vec<ProposedEdge>) {
    let mut nodes = Vec::new();

    for module in &amg.modules {
        let mut properties = Map::new();
        insert_property(&mut properties, "moduleType", &module.module_type);
        insert_property(&mut properties, "language", &module.language);
        properties.insert("loc".to_string(), Value::from(module.loc));
        properties.insert("lloc".to_string(), Value::from(module.lloc));
        nodes.push(imported_node(
            module.id.clone(),
            NodeType::Module,
            module.name.clone(),
            properties,
            nodes.len(),
        ));
    }

    for container in &amg.containers {
        let mut properties = Map::new();
        properties.insert(
            "technology".to_string(),
            Value::String(container.technology.clone()),
        );
        insert_property(&mut properties, "containerType", &container.container_type);
        properties.insert(
            "description".to_string(),
            Value::String(container.description.clone()),
        );
        properties.insert(
            "moduleIds".to_string(),
            serde_json::to_value(&container.module_ids).unwrap_or(Value::Array(Vec::new())),
        );
        nodes.push(imported_node(
            container.id.clone(),
            NodeType::Container,
            container.name.clone(),
            properties,
            nodes.len(),
        ));
    }

    for system in &amg.external_systems {
        let mut properties = Map::new();
        properties.insert(
            "description".to_string(),
            Value::String(system.description.clone()),
        );
        insert_property(&mut properties, "systemType", &system.system_type);
        insert_property(&mut properties, "protocol", &system.protocol);
        nodes.push(imported_node(
            system.id.clone(),
            NodeType::ExternalSystem,
            system.name.clone(),
            properties,
            nodes.len(),
        ));
    }

    for actor in &amg.actors {
        let mut properties = Map::new();
        properties.insert("role".to_string(), Value::String(actor.role.clone()));
        properties.insert(
            "description".to_string(),
            Value::String(actor.description.clone()),
        );
        nodes.push(imported_node(
            actor.id.clone(),
            NodeType::Actor,
            actor.name.clone(),
            properties,
            nodes.len(),
        ));
    }

    let node_ids: HashSet<&str> = nodes.iter().map(|node| node.id.as_str()).collect();
    let mut edges = Vec::new();

    for dependency in &amg.dependencies {
        if !node_ids.contains(dependency.source.as_str())
            || !node_ids.contains(dependency.target.as_str())
        {
            continue;
        }
        let mut properties = Map::new();
        insert_property(&mut properties, "kind", &dependency.kind);
        properties.insert("weight".to_string(), Value::from(dependency.weight));
        let label = serde_json::to_value(dependency.kind)
            .ok()
            .and_then(|value| value.as_str().map(ToString::to_string));
        edges.push(imported_edge(
            EdgeType::Dependency,
            dependency.source.clone(),
            dependency.target.clone(),
            label,
            properties,
        ));
    }

    for container in &amg.containers {
        for module_id in &container.module_ids {
            if node_ids.contains(container.id.as_str()) && node_ids.contains(module_id.as_str()) {
                edges.push(imported_edge(
                    EdgeType::Containment,
                    container.id.clone(),
                    module_id.clone(),
                    None,
                    Map::new(),
                ));
            }
        }
    }

    for call in &amg.external_calls {
        if !node_ids.contains(call.module_id.as_str())
            || !node_ids.contains(call.external_system_id.as_str())
        {
            continue;
        }
        let mut properties = Map::new();
        insert_property(&mut properties, "protocol", &call.protocol);
        properties.insert(
            "description".to_string(),
            Value::String(call.description.clone()),
        );
        let label = serde_json::to_value(call.protocol)
            .ok()
            .and_then(|value| value.as_str().map(ToString::to_string));
        edges.push(imported_edge(
            EdgeType::ExternalCall,
            call.module_id.clone(),
            call.external_system_id.clone(),
            label,
            properties,
        ));
    }

    (nodes, deduplicate_edges(edges))
}

pub(crate) fn nodes_semantically_equal(left: &ProposedNode, right: &ProposedNode) -> bool {
    left.node_type == right.node_type
        && left.label == right.label
        && left.properties == right.properties
}

pub(crate) fn edges_semantically_equal(left: &ProposedEdge, right: &ProposedEdge) -> bool {
    left.source == right.source
        && left.target == right.target
        && left.edge_type == right.edge_type
        && left.label == right.label
        && left.properties == right.properties
}

fn recalculate_modified(
    project_path: &str,
    architecture: &mut ProposedArchitecture,
) -> Result<(), DesignError> {
    let Some(run_id) = architecture.based_on_analysis_run_id.as_deref() else {
        if architecture
            .nodes
            .iter()
            .any(|node| node.origin == NodeOrigin::Imported)
            || architecture
                .edges
                .iter()
                .any(|edge| edge.origin == NodeOrigin::Imported)
        {
            return Err(DesignError::InvalidGraph(
                "un diseño sin corrida base no puede contener elementos importados".to_string(),
            ));
        }
        for node in &mut architecture.nodes {
            node.modified = false;
        }
        for edge in &mut architecture.edges {
            edge.modified = false;
        }
        return Ok(());
    };

    let base = HistoryManager::load_amg_for_run(project_path, run_id)
        .ok_or_else(|| DesignError::BaseRunNotFound(run_id.to_string()))?;
    let (base_nodes, base_edges) = import_graph(&base);
    let node_map: HashMap<&str, &ProposedNode> = base_nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let edge_map: HashMap<&str, &ProposedEdge> = base_edges
        .iter()
        .map(|edge| (edge.id.as_str(), edge))
        .collect();

    for node in &mut architecture.nodes {
        match node.origin {
            NodeOrigin::Proposed => node.modified = false,
            NodeOrigin::Imported => {
                let original_id = node.original_node_id.as_deref().ok_or_else(|| {
                    DesignError::InvalidGraph(format!(
                        "el nodo importado '{}' no tiene originalNodeId",
                        node.id
                    ))
                })?;
                let original = node_map.get(original_id).ok_or_else(|| {
                    DesignError::InvalidGraph(format!(
                        "el nodo importado '{}' no existe en la corrida base",
                        original_id
                    ))
                })?;
                node.modified = !nodes_semantically_equal(node, original);
            }
        }
    }

    for edge in &mut architecture.edges {
        match edge.origin {
            NodeOrigin::Proposed => edge.modified = false,
            NodeOrigin::Imported => {
                let original_id = edge.original_edge_id.as_deref().ok_or_else(|| {
                    DesignError::InvalidGraph(format!(
                        "la arista importada '{}' no tiene originalEdgeId",
                        edge.id
                    ))
                })?;
                let original = edge_map.get(original_id).ok_or_else(|| {
                    DesignError::InvalidGraph(format!(
                        "la arista importada '{}' no existe en la corrida base",
                        original_id
                    ))
                })?;
                edge.modified = !edges_semantically_equal(edge, original);
            }
        }
    }
    Ok(())
}

fn validate_architecture(architecture: &ProposedArchitecture) -> Result<(), DesignError> {
    validate_design_id(&architecture.id)?;
    if architecture.schema_version != DESIGN_SCHEMA_VERSION {
        return Err(DesignError::InvalidGraph(format!(
            "schemaVersion no soportado: {}",
            architecture.schema_version
        )));
    }
    if architecture.revision == 0 {
        return Err(DesignError::InvalidGraph(
            "revision debe ser mayor que cero".to_string(),
        ));
    }
    if architecture.project_id.trim().is_empty() || architecture.name.trim().is_empty() {
        return Err(DesignError::InvalidGraph(
            "projectId y name no pueden estar vacíos".to_string(),
        ));
    }
    if !architecture.canvas_layout.viewport.x.is_finite()
        || !architecture.canvas_layout.viewport.y.is_finite()
        || !architecture.canvas_layout.zoom.is_finite()
        || architecture.canvas_layout.zoom <= 0.0
    {
        return Err(DesignError::InvalidGraph(
            "canvasLayout contiene valores no finitos o zoom no positivo".to_string(),
        ));
    }

    let mut node_ids = HashSet::new();
    for node in &architecture.nodes {
        if node.id.trim().is_empty() || !node_ids.insert(node.id.as_str()) {
            return Err(DesignError::InvalidGraph(format!(
                "ID de nodo vacío o duplicado: '{}'",
                node.id
            )));
        }
        if !node.position.x.is_finite() || !node.position.y.is_finite() {
            return Err(DesignError::InvalidGraph(format!(
                "posición no finita para el nodo '{}'",
                node.id
            )));
        }
        if node.label.trim().is_empty() || !is_design_node_type(node.node_type) {
            return Err(DesignError::InvalidGraph(format!(
                "tipo o etiqueta inválida para el nodo '{}'",
                node.id
            )));
        }
        match node.origin {
            NodeOrigin::Imported if node.original_node_id.as_deref() != Some(node.id.as_str()) => {
                return Err(DesignError::InvalidGraph(format!(
                    "el nodo importado '{}' debe conservar su ID original",
                    node.id
                )));
            }
            NodeOrigin::Proposed => {
                validate_proposed_id(&node.id)?;
                if node.original_node_id.is_some() {
                    return Err(DesignError::InvalidGraph(format!(
                        "el nodo propuesto '{}' no puede tener originalNodeId",
                        node.id
                    )));
                }
            }
            NodeOrigin::Imported => {}
        }
    }

    let mut edge_ids = HashSet::new();
    for edge in &architecture.edges {
        if edge.id.trim().is_empty() || !edge_ids.insert(edge.id.as_str()) {
            return Err(DesignError::InvalidGraph(format!(
                "ID de arista vacío o duplicado: '{}'",
                edge.id
            )));
        }
        if !node_ids.contains(edge.source.as_str()) || !node_ids.contains(edge.target.as_str()) {
            return Err(DesignError::InvalidGraph(format!(
                "la arista '{}' referencia un nodo inexistente",
                edge.id
            )));
        }
        match edge.origin {
            NodeOrigin::Imported if edge.original_edge_id.as_deref() != Some(edge.id.as_str()) => {
                return Err(DesignError::InvalidGraph(format!(
                    "la arista importada '{}' debe conservar su ID original",
                    edge.id
                )));
            }
            NodeOrigin::Proposed if edge.original_edge_id.is_some() => {
                return Err(DesignError::InvalidGraph(format!(
                    "la arista propuesta '{}' no puede tener originalEdgeId",
                    edge.id
                )));
            }
            _ => {}
        }
    }
    Ok(())
}

fn is_design_node_type(node_type: NodeType) -> bool {
    matches!(
        node_type,
        NodeType::Module | NodeType::Container | NodeType::ExternalSystem | NodeType::Actor
    )
}

fn imported_node(
    id: String,
    node_type: NodeType,
    label: String,
    properties: Map<String, Value>,
    index: usize,
) -> ProposedNode {
    ProposedNode {
        original_node_id: Some(id.clone()),
        id,
        origin: NodeOrigin::Imported,
        node_type,
        label,
        modified: false,
        properties,
        position: NodePosition {
            x: ((index % 4) as f64) * 280.0,
            y: ((index / 4) as f64) * 180.0,
        },
    }
}

fn imported_edge(
    edge_type: EdgeType,
    source: String,
    target: String,
    label: Option<String>,
    properties: Map<String, Value>,
) -> ProposedEdge {
    let id = deterministic_edge_id(edge_type, &source, &target, &label, &properties);
    ProposedEdge {
        original_edge_id: Some(id.clone()),
        id,
        origin: NodeOrigin::Imported,
        source,
        target,
        edge_type,
        label,
        modified: false,
        properties,
    }
}

fn deduplicate_edges(edges: Vec<ProposedEdge>) -> Vec<ProposedEdge> {
    let mut seen = HashSet::new();
    edges
        .into_iter()
        .filter(|edge| seen.insert(edge.id.clone()))
        .collect()
}

fn deterministic_edge_id(
    edge_type: EdgeType,
    source: &str,
    target: &str,
    label: &Option<String>,
    properties: &Map<String, Value>,
) -> String {
    let canonical = serde_json::json!({
        "edgeType": edge_type,
        "source": source,
        "target": target,
        "label": label,
        "properties": properties,
    });
    let bytes = serde_json::to_vec(&canonical).unwrap_or_default();
    format!("edge_{:x}", Sha256::digest(bytes))
}

fn insert_property<T: Serialize>(properties: &mut Map<String, Value>, key: &str, value: &T) {
    if let Ok(value) = serde_json::to_value(value) {
        properties.insert(key.to_string(), value);
    }
}

fn canonical_project_root(project_path: &str) -> Result<PathBuf, DesignError> {
    let path = Path::new(project_path);
    let canonical = fs::canonicalize(path)
        .map_err(|_| DesignError::InvalidProjectPath(path.display().to_string()))?;
    if !canonical.is_dir() {
        return Err(DesignError::InvalidProjectPath(
            canonical.display().to_string(),
        ));
    }
    Ok(canonical)
}

fn project_id_for_project(project_path: &str) -> String {
    let history = HistoryManager::load_history(project_path);
    if let Some(project_id) = history.runs.iter().rev().find_map(|run| {
        HistoryManager::load_amg_for_run(project_path, &run.run_id).map(|amg| amg.project_id)
    }) {
        return project_id;
    }
    format!("{:x}", Sha256::digest(project_path.as_bytes()))
}

fn validate_design_id(design_id: &str) -> Result<(), DesignError> {
    let uuid = design_id
        .strip_prefix("design_")
        .and_then(|value| Uuid::parse_str(value).ok());
    if uuid.is_none() || design_id.contains('/') || design_id.contains('\\') {
        return Err(DesignError::InvalidDesignId(design_id.to_string()));
    }
    Ok(())
}

fn validate_proposed_id(node_id: &str) -> Result<(), DesignError> {
    let valid = node_id
        .strip_prefix("prop_")
        .and_then(|value| Uuid::parse_str(value).ok())
        .is_some();
    if valid {
        Ok(())
    } else {
        Err(DesignError::InvalidGraph(format!(
            "ID de nodo propuesto inválido: '{}'",
            node_id
        )))
    }
}

fn designs_dir(project_root: &Path) -> PathBuf {
    project_root.join(".saac").join("proposed_architectures")
}

fn design_path(dir: &Path, design_id: &str) -> PathBuf {
    dir.join(format!("{}.json", design_id))
}

fn snapshots_dir(dir: &Path, design_id: &str) -> PathBuf {
    dir.join(format!("{}_snapshots", design_id))
}

fn index_path(dir: &Path) -> PathBuf {
    dir.join("index.json")
}

fn load_or_rebuild_index(dir: &Path) -> Result<DesignIndex, DesignError> {
    let path = index_path(dir);
    if path.is_file() {
        return read_json(&path);
    }

    let mut index = DesignIndex::default();
    for entry in fs::read_dir(dir).map_err(|source| DesignError::Io {
        path: dir.display().to_string(),
        source,
    })? {
        let entry = entry.map_err(|source| DesignError::Io {
            path: dir.display().to_string(),
            source,
        })?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(design_id) = file_name.strip_suffix(".json") else {
            continue;
        };
        if design_id == "index" || validate_design_id(design_id).is_err() {
            continue;
        }
        let architecture: ProposedArchitecture = read_json(&path)?;
        validate_architecture(&architecture)?;
        index.designs.push((&architecture).into());
    }
    index.designs.sort_by(|a, b| {
        b.updated_at
            .cmp(&a.updated_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    write_json_atomic(&path, &index)?;
    Ok(index)
}

fn upsert_index(dir: &Path, architecture: &ProposedArchitecture) -> Result<(), DesignError> {
    let mut index = load_or_rebuild_index(dir)?;
    index
        .designs
        .retain(|summary| summary.id != architecture.id);
    index.designs.push(architecture.into());
    index.designs.sort_by(|a, b| {
        b.updated_at
            .cmp(&a.updated_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    write_json_atomic(&index_path(dir), &index)
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, DesignError> {
    let content = fs::read_to_string(path).map_err(|source| DesignError::Io {
        path: path.display().to_string(),
        source,
    })?;
    serde_json::from_str(&content).map_err(|source| DesignError::Json {
        path: path.display().to_string(),
        source,
    })
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), DesignError> {
    let parent = path
        .parent()
        .ok_or_else(|| DesignError::InvalidProjectPath(path.display().to_string()))?;
    create_dir_all(parent)?;
    let content = serde_json::to_vec_pretty(value).map_err(|source| DesignError::Json {
        path: path.display().to_string(),
        source,
    })?;
    let temporary = parent.join(format!(".tmp-{}", Uuid::new_v4()));
    let mut file = fs::File::create(&temporary).map_err(|source| DesignError::Io {
        path: temporary.display().to_string(),
        source,
    })?;
    file.write_all(&content).map_err(|source| DesignError::Io {
        path: temporary.display().to_string(),
        source,
    })?;
    file.sync_all().map_err(|source| DesignError::Io {
        path: temporary.display().to_string(),
        source,
    })?;
    drop(file);

    if path.exists() {
        remove_file(path)?;
    }
    fs::rename(&temporary, path).map_err(|source| DesignError::Io {
        path: path.display().to_string(),
        source,
    })
}

fn create_dir_all(path: &Path) -> Result<(), DesignError> {
    fs::create_dir_all(path).map_err(|source| DesignError::Io {
        path: path.display().to_string(),
        source,
    })
}

fn remove_file(path: &Path) -> Result<(), DesignError> {
    fs::remove_file(path).map_err(|source| DesignError::Io {
        path: path.display().to_string(),
        source,
    })
}
