use super::*;
use crate::engine::amg::{
    Actor, ArchStyle, ArchitectureModelGraph, C4Models, Container, ContainerType, Dependency,
    DependencyKind, EdgeType, ExternalCall, ExternalProtocol, ExternalSystem, ExternalSystemType,
    Language, Module, ModuleMetrics, ModuleType, NodeType, ProjectMetrics, ProjectType,
    SnapshotType,
};
use crate::engine::history::HistoryManager;
use serde_json::{json, Map};
use tempfile::TempDir;
use uuid::Uuid;

#[test]
fn serde_uses_camel_case_and_lowercase_origin() {
    let temp = TempDir::new().unwrap();
    let architecture = DesignManager::create(
        temp.path().to_str().unwrap(),
        "Diseño".to_string(),
        None,
        None,
    )
    .unwrap();
    let node = ProposedNode {
        id: format!("prop_{}", Uuid::new_v4()),
        origin: NodeOrigin::Proposed,
        original_node_id: None,
        node_type: NodeType::ExternalSystem,
        label: "API".to_string(),
        modified: false,
        properties: Map::new(),
        position: NodePosition { x: 1.0, y: 2.0 },
    };

    let architecture_json = serde_json::to_value(&architecture).unwrap();
    let node_json = serde_json::to_value(&node).unwrap();
    assert_eq!(architecture_json["schemaVersion"], json!(1));
    assert!(architecture_json.get("canvasLayout").is_some());
    assert_eq!(node_json["origin"], json!("proposed"));
    assert_eq!(node_json["nodeType"], json!("external-system"));
    assert!(node_json.get("originalNodeId").is_some());
}

#[test]
fn crud_round_trip_creates_snapshots_and_rejects_stale_revision() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().to_str().unwrap();
    let architecture = DesignManager::create(
        root,
        "Migración".to_string(),
        Some("Separar servicios".to_string()),
        None,
    )
    .unwrap();

    let added = DesignManager::add_proposed_node(
        root,
        &architecture.id,
        NodeType::Container,
        "API nueva".to_string(),
        NodePosition { x: 10.0, y: 20.0 },
    )
    .unwrap();
    assert!(added.id.starts_with("prop_"));

    let loaded = DesignManager::load(root, &architecture.id).unwrap();
    assert_eq!(loaded.revision, 2);
    assert_eq!(loaded.nodes.len(), 1);
    assert_eq!(DesignManager::list(root).unwrap().len(), 1);
    let snapshots = DesignManager::list_snapshots(root, &architecture.id).unwrap();
    assert_eq!(snapshots.len(), 1);
    assert_eq!(snapshots[0].revision, 2);
    assert_eq!(snapshots[0].architecture, loaded);

    let stale = DesignManager::update(root, &architecture.id, architecture.clone()).unwrap_err();
    assert!(matches!(stale, DesignError::RevisionConflict { .. }));

    DesignManager::delete(root, &architecture.id).unwrap();
    assert!(DesignManager::list(root).unwrap().is_empty());
    assert!(matches!(
        DesignManager::load(root, &architecture.id),
        Err(DesignError::NotFound(_))
    ));
}

#[test]
fn clone_from_amg_imports_supported_nodes_and_edges() {
    let temp = TempDir::new().unwrap();
    let amg = sample_amg();
    let architecture = DesignManager::create(
        temp.path().to_str().unwrap(),
        "Derivada".to_string(),
        None,
        Some(&amg),
    )
    .unwrap();

    assert_eq!(architecture.project_id, amg.project_id);
    assert_eq!(
        architecture.based_on_analysis_run_id.as_deref(),
        Some(amg.analysis_run_id.as_str())
    );
    assert_eq!(architecture.nodes.len(), 5);
    assert_eq!(architecture.edges.len(), 4);
    assert!(architecture.nodes.iter().all(|node| {
        node.origin == NodeOrigin::Imported
            && node.original_node_id.as_deref() == Some(node.id.as_str())
    }));
    assert!(architecture
        .edges
        .iter()
        .any(|edge| edge.edge_type == EdgeType::Dependency));
    assert!(architecture
        .edges
        .iter()
        .any(|edge| edge.edge_type == EdgeType::Containment));
    assert!(architecture
        .edges
        .iter()
        .any(|edge| edge.edge_type == EdgeType::ExternalCall));
}

#[test]
fn comparison_reports_added_removed_and_modified_deterministically() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().to_str().unwrap();
    let amg = sample_amg();
    persist_run(root, &amg);
    let empty = DesignManager::create(root, "Vacía".to_string(), None, None).unwrap();
    assert_eq!(empty.project_id, amg.project_id);
    DesignManager::delete(root, &empty.id).unwrap();

    let mut architecture =
        DesignManager::create(root, "Derivada".to_string(), None, Some(&amg)).unwrap();

    architecture
        .nodes
        .iter_mut()
        .find(|node| node.id == "module:a")
        .unwrap()
        .label = "Módulo A renombrado".to_string();
    architecture.nodes.retain(|node| node.id != "container:app");
    architecture
        .edges
        .retain(|edge| edge.source != "container:app" && edge.target != "container:app");
    let proposed_id = format!("prop_{}", Uuid::new_v4());
    architecture.nodes.push(ProposedNode {
        id: proposed_id.clone(),
        origin: NodeOrigin::Proposed,
        original_node_id: None,
        node_type: NodeType::ExternalSystem,
        label: "Nuevo sistema".to_string(),
        modified: false,
        properties: Map::new(),
        position: NodePosition { x: 0.0, y: 0.0 },
    });
    DesignManager::update(root, &architecture.id, architecture.clone()).unwrap();

    let report =
        compare_proposed_architecture(root, &architecture.id, &amg.analysis_run_id).unwrap();
    assert_eq!(report.nodes_added, vec![proposed_id]);
    assert_eq!(report.nodes_removed, vec!["container:app".to_string()]);
    assert!(report
        .nodes_modified
        .iter()
        .any(|diff| diff.node_id == "module:a" && diff.field == "label"));
    assert_eq!(report.edges_removed.len(), 2);
    assert_eq!(
        report.structural_summary,
        "Nodos: +1, -1, modificados 1; aristas: +0, -2."
    );
}

#[test]
fn exporters_emit_deterministic_escaped_documents() {
    let mut architecture = empty_architecture("Diseño \"principal\"");
    let first = proposed_node("Origen \"A\"", NodeType::Actor);
    let second = proposed_node("Destino | B", NodeType::ExternalSystem);
    architecture.edges.push(ProposedEdge {
        id: "edge_relation".to_string(),
        origin: NodeOrigin::Proposed,
        original_edge_id: None,
        source: first.id.clone(),
        target: second.id.clone(),
        edge_type: EdgeType::Dependency,
        label: Some("usa | \"API\"".to_string()),
        modified: false,
        properties: Map::new(),
    });
    architecture.nodes = vec![first, second];

    let mermaid = export_architecture(&architecture, ExportFormat::Mermaid);
    let plantuml = export_architecture(&architecture, ExportFormat::PlantUml);
    let structurizr = export_architecture(&architecture, ExportFormat::StructurizrDsl);

    assert!(mermaid.starts_with("flowchart LR\n"));
    assert!(mermaid.contains("&quot;A&quot;"));
    assert!(mermaid.contains("&#124;"));
    assert!(plantuml.starts_with("@startuml\n"));
    assert!(plantuml.contains("Diseño \\\"principal\\\""));
    assert!(plantuml.ends_with("@enduml\n"));
    assert!(structurizr.starts_with("workspace \"Diseño \\\"principal\\\"\""));
    assert!(structurizr.contains("person"));
    assert!(structurizr.contains("softwareSystem"));
    assert!(structurizr.contains("systemLandscape"));
}

#[test]
fn path_traversal_design_ids_are_rejected() {
    let temp = TempDir::new().unwrap();
    let root = temp.path().to_str().unwrap();
    for invalid in ["../history", "design_../../history", "design_not-a-uuid"] {
        assert!(matches!(
            DesignManager::load(root, invalid),
            Err(DesignError::InvalidDesignId(_))
        ));
    }
}

fn proposed_node(label: &str, node_type: NodeType) -> ProposedNode {
    ProposedNode {
        id: format!("prop_{}", Uuid::new_v4()),
        origin: NodeOrigin::Proposed,
        original_node_id: None,
        node_type,
        label: label.to_string(),
        modified: false,
        properties: Map::new(),
        position: NodePosition { x: 0.0, y: 0.0 },
    }
}

fn empty_architecture(name: &str) -> ProposedArchitecture {
    ProposedArchitecture {
        schema_version: DESIGN_SCHEMA_VERSION,
        id: format!("design_{}", Uuid::new_v4()),
        project_id: "project-test".to_string(),
        name: name.to_string(),
        description: Some("Descripción".to_string()),
        based_on_analysis_run_id: None,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
        revision: 1,
        nodes: Vec::new(),
        edges: Vec::new(),
        canvas_layout: CanvasLayout::default(),
    }
}

fn persist_run(root: &str, amg: &ArchitectureModelGraph) {
    HistoryManager::record_run(root, &amg.analysis_run_id, 2, 2, 0, 10, amg, 100.0).unwrap();
}

fn sample_amg() -> ArchitectureModelGraph {
    ArchitectureModelGraph {
        amg_id: "amg-1".to_string(),
        analysis_run_id: "run-1".to_string(),
        project_id: "project-1".to_string(),
        project_name: "Proyecto".to_string(),
        detected_type: ProjectType::Server,
        detected_style: ArchStyle::Layered,
        style_confidence: 0.9,
        analyzed_at: "2026-01-01T00:00:00Z".to_string(),
        parent_amg_id: None,
        snapshot_type: SnapshotType::Full,
        modules: vec![
            sample_module("module:a", "A"),
            sample_module("module:b", "B"),
        ],
        dependencies: vec![Dependency {
            source: "module:a".to_string(),
            target: "module:b".to_string(),
            kind: DependencyKind::Import,
            weight: 1,
        }],
        containers: vec![Container {
            id: "container:app".to_string(),
            node_type: NodeType::Container,
            stable_since: "run-1".to_string(),
            last_seen_in: "run-1".to_string(),
            name: "Aplicación".to_string(),
            technology: "Rust".to_string(),
            container_type: ContainerType::Api,
            description: "API".to_string(),
            module_ids: vec!["module:a".to_string(), "module:b".to_string()],
            detected_from: "test".to_string(),
        }],
        external_systems: vec![ExternalSystem {
            id: "external:payments".to_string(),
            node_type: NodeType::ExternalSystem,
            stable_since: "run-1".to_string(),
            last_seen_in: "run-1".to_string(),
            name: "Pagos".to_string(),
            description: "Proveedor".to_string(),
            system_type: ExternalSystemType::Api,
            protocol: ExternalProtocol::Https,
            detected_via: "test".to_string(),
        }],
        actors: vec![Actor {
            id: "actor:user".to_string(),
            node_type: NodeType::Actor,
            stable_since: "run-1".to_string(),
            last_seen_in: "run-1".to_string(),
            name: "Usuario".to_string(),
            role: "Cliente".to_string(),
            description: "Usa el sistema".to_string(),
        }],
        external_calls: vec![ExternalCall {
            module_id: "module:b".to_string(),
            external_system_id: "external:payments".to_string(),
            protocol: ExternalProtocol::Https,
            description: "Cobra".to_string(),
        }],
        antipatterns: Vec::new(),
        metrics: ProjectMetrics::default(),
        c4_models: C4Models::default(),
    }
}

fn sample_module(id: &str, name: &str) -> Module {
    Module {
        id: id.to_string(),
        node_type: NodeType::Module,
        name: name.to_string(),
        module_type: ModuleType::Service,
        language: Language::Rust,
        loc: 10,
        lloc: 8,
        classes: Vec::new(),
        functions: Vec::new(),
        imports: Vec::new(),
        imported_by: Vec::new(),
        stable_since: "run-1".to_string(),
        last_seen_in: "run-1".to_string(),
        metrics: ModuleMetrics {
            ca: 0,
            ce: 0,
            instability: 0.0,
            abstractness: 0.0,
            distance: 0.0,
            lcom4: 0,
            maintainability_index: 100.0,
            cyclomatic_complexity_avg: 1.0,
            cyclomatic_complexity_max: 1,
            module_cohesion: 1.0,
            connascence: None,
            quantum_id: None,
        },
    }
}
