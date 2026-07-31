use crate::engine::amg::{EdgeType, NodeType};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const DESIGN_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedArchitecture {
    pub schema_version: u32,
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub based_on_analysis_run_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub revision: u64,
    pub nodes: Vec<ProposedNode>,
    pub edges: Vec<ProposedEdge>,
    pub canvas_layout: CanvasLayout,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeOrigin {
    Imported,
    Proposed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedNode {
    pub id: String,
    pub origin: NodeOrigin,
    pub original_node_id: Option<String>,
    pub node_type: NodeType,
    pub label: String,
    pub modified: bool,
    #[serde(default)]
    pub properties: Map<String, Value>,
    pub position: NodePosition,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedEdge {
    pub id: String,
    pub origin: NodeOrigin,
    pub original_edge_id: Option<String>,
    pub source: String,
    pub target: String,
    pub edge_type: EdgeType,
    pub label: Option<String>,
    pub modified: bool,
    #[serde(default)]
    pub properties: Map<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasLayout {
    pub viewport: NodePosition,
    pub zoom: f64,
}

impl Default for CanvasLayout {
    fn default() -> Self {
        Self {
            viewport: NodePosition { x: 0.0, y: 0.0 },
            zoom: 1.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedArchitectureSummary {
    pub schema_version: u32,
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub based_on_analysis_run_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub revision: u64,
    pub node_count: usize,
    pub edge_count: usize,
}

impl From<&ProposedArchitecture> for ProposedArchitectureSummary {
    fn from(architecture: &ProposedArchitecture) -> Self {
        Self {
            schema_version: architecture.schema_version,
            id: architecture.id.clone(),
            project_id: architecture.project_id.clone(),
            name: architecture.name.clone(),
            description: architecture.description.clone(),
            based_on_analysis_run_id: architecture.based_on_analysis_run_id.clone(),
            created_at: architecture.created_at.clone(),
            updated_at: architecture.updated_at.clone(),
            revision: architecture.revision,
            node_count: architecture.nodes.len(),
            edge_count: architecture.edges.len(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignSnapshot {
    pub id: String,
    pub design_id: String,
    pub revision: u64,
    pub created_at: String,
    pub architecture: ProposedArchitecture,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesignIndex {
    pub schema_version: u32,
    pub designs: Vec<ProposedArchitectureSummary>,
}

impl Default for DesignIndex {
    fn default() -> Self {
        Self {
            schema_version: DESIGN_SCHEMA_VERSION,
            designs: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonReport {
    pub proposed_architecture_id: String,
    pub compared_against_run_id: String,
    pub nodes_added: Vec<String>,
    pub nodes_removed: Vec<String>,
    pub nodes_modified: Vec<NodeDiff>,
    pub edges_added: Vec<String>,
    pub edges_removed: Vec<String>,
    pub structural_summary: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDiff {
    pub node_id: String,
    pub field: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExportFormat {
    StructurizrDsl,
    PlantUml,
    Mermaid,
}
