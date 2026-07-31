use super::model::{ComparisonReport, NodeDiff, NodeOrigin, ProposedEdge, ProposedNode};
use super::storage::{
    edges_semantically_equal, import_graph, nodes_semantically_equal, DesignError, DesignManager,
};
use crate::engine::history::HistoryManager;
use std::collections::{BTreeSet, HashMap, HashSet};

pub fn compare_proposed_architecture(
    project_path: &str,
    design_id: &str,
    against_run_id: &str,
) -> Result<ComparisonReport, DesignError> {
    let architecture = DesignManager::load(project_path, design_id)?;
    let amg = HistoryManager::load_amg_for_run(project_path, against_run_id)
        .ok_or_else(|| DesignError::BaseRunNotFound(against_run_id.to_string()))?;
    if architecture.project_id != amg.project_id {
        return Err(DesignError::ProjectMismatch);
    }

    let (baseline_nodes, baseline_edges) = import_graph(&amg);
    Ok(compare_graphs(
        design_id,
        against_run_id,
        &architecture.nodes,
        &architecture.edges,
        &baseline_nodes,
        &baseline_edges,
    ))
}

fn compare_graphs(
    design_id: &str,
    run_id: &str,
    current_nodes: &[ProposedNode],
    current_edges: &[ProposedEdge],
    baseline_nodes: &[ProposedNode],
    baseline_edges: &[ProposedEdge],
) -> ComparisonReport {
    let baseline_node_map: HashMap<&str, &ProposedNode> = baseline_nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let current_node_identities: HashSet<&str> = current_nodes
        .iter()
        .map(|node| node.original_node_id.as_deref().unwrap_or(node.id.as_str()))
        .collect();

    let mut nodes_added = Vec::new();
    let mut nodes_modified = Vec::new();
    for node in current_nodes {
        let identity = node.original_node_id.as_deref().unwrap_or(node.id.as_str());
        if node.origin == NodeOrigin::Proposed || !baseline_node_map.contains_key(identity) {
            nodes_added.push(node.id.clone());
        } else if let Some(original) = baseline_node_map.get(identity) {
            append_node_diffs(&mut nodes_modified, node, original);
        }
    }
    let mut nodes_removed: Vec<String> = baseline_nodes
        .iter()
        .filter(|node| !current_node_identities.contains(node.id.as_str()))
        .map(|node| node.id.clone())
        .collect();

    let baseline_edge_map: HashMap<&str, &ProposedEdge> = baseline_edges
        .iter()
        .map(|edge| (edge.id.as_str(), edge))
        .collect();
    let current_edge_identities: HashSet<&str> = current_edges
        .iter()
        .map(|edge| edge.original_edge_id.as_deref().unwrap_or(edge.id.as_str()))
        .collect();

    let mut edges_added = Vec::new();
    let mut edges_removed: Vec<String> = baseline_edges
        .iter()
        .filter(|edge| !current_edge_identities.contains(edge.id.as_str()))
        .map(|edge| edge.id.clone())
        .collect();
    for edge in current_edges {
        let identity = edge.original_edge_id.as_deref().unwrap_or(edge.id.as_str());
        if edge.origin == NodeOrigin::Proposed || !baseline_edge_map.contains_key(identity) {
            edges_added.push(edge.id.clone());
        } else if let Some(original) = baseline_edge_map.get(identity) {
            if !edges_semantically_equal(edge, original) {
                edges_added.push(edge.id.clone());
                edges_removed.push(original.id.clone());
            }
        }
    }

    nodes_added.sort();
    nodes_added.dedup();
    nodes_removed.sort();
    nodes_removed.dedup();
    nodes_modified.sort_by(|a, b| {
        a.node_id
            .cmp(&b.node_id)
            .then_with(|| a.field.cmp(&b.field))
    });
    edges_added.sort();
    edges_added.dedup();
    edges_removed.sort();
    edges_removed.dedup();

    let modified_node_count = nodes_modified
        .iter()
        .map(|diff| diff.node_id.as_str())
        .collect::<HashSet<_>>()
        .len();
    let structural_summary = format!(
        "Nodos: +{}, -{}, modificados {}; aristas: +{}, -{}.",
        nodes_added.len(),
        nodes_removed.len(),
        modified_node_count,
        edges_added.len(),
        edges_removed.len()
    );

    ComparisonReport {
        proposed_architecture_id: design_id.to_string(),
        compared_against_run_id: run_id.to_string(),
        nodes_added,
        nodes_removed,
        nodes_modified,
        edges_added,
        edges_removed,
        structural_summary,
    }
}

fn append_node_diffs(diffs: &mut Vec<NodeDiff>, current: &ProposedNode, original: &ProposedNode) {
    if nodes_semantically_equal(current, original) {
        return;
    }
    if current.label != original.label {
        diffs.push(NodeDiff {
            node_id: current.id.clone(),
            field: "label".to_string(),
            before: original.label.clone(),
            after: current.label.clone(),
        });
    }
    if current.node_type != original.node_type {
        diffs.push(NodeDiff {
            node_id: current.id.clone(),
            field: "nodeType".to_string(),
            before: json_string(&original.node_type),
            after: json_string(&current.node_type),
        });
    }

    let keys: BTreeSet<&str> = original
        .properties
        .keys()
        .chain(current.properties.keys())
        .map(String::as_str)
        .collect();
    for key in keys {
        let before = original.properties.get(key);
        let after = current.properties.get(key);
        if before != after {
            diffs.push(NodeDiff {
                node_id: current.id.clone(),
                field: format!("properties.{}", key),
                before: before
                    .map(json_string)
                    .unwrap_or_else(|| "null".to_string()),
                after: after.map(json_string).unwrap_or_else(|| "null".to_string()),
            });
        }
    }
}

fn json_string<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}
