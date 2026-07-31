use super::model::{ExportFormat, ProposedArchitecture, ProposedEdge, ProposedNode};
use super::storage::{DesignError, DesignManager};
use crate::engine::amg::NodeType;
use std::collections::HashMap;

pub fn export_proposed_architecture(
    project_path: &str,
    design_id: &str,
    format: ExportFormat,
) -> Result<String, DesignError> {
    let architecture = DesignManager::load(project_path, design_id)?;
    Ok(export_architecture(&architecture, format))
}

pub fn export_architecture(architecture: &ProposedArchitecture, format: ExportFormat) -> String {
    match format {
        ExportFormat::Mermaid => export_mermaid(architecture),
        ExportFormat::PlantUml => export_plantuml(architecture),
        ExportFormat::StructurizrDsl => export_structurizr(architecture),
    }
}

fn sorted_graph(
    architecture: &ProposedArchitecture,
) -> (
    Vec<&ProposedNode>,
    Vec<&ProposedEdge>,
    HashMap<String, String>,
) {
    let mut nodes: Vec<&ProposedNode> = architecture.nodes.iter().collect();
    nodes.sort_by(|a, b| a.id.cmp(&b.id));
    let aliases = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (node.id.clone(), format!("n{}", index)))
        .collect();
    let mut edges: Vec<&ProposedEdge> = architecture.edges.iter().collect();
    edges.sort_by(|a, b| a.id.cmp(&b.id));
    (nodes, edges, aliases)
}

fn export_mermaid(architecture: &ProposedArchitecture) -> String {
    let (nodes, edges, aliases) = sorted_graph(architecture);
    let mut output = String::from("flowchart LR\n");
    for node in nodes {
        let alias = aliases.get(&node.id).expect("alias de nodo");
        output.push_str(&format!(
            "    {}[\"{}\"]\n",
            alias,
            escape_mermaid(&node.label)
        ));
    }
    for edge in edges {
        let (Some(source), Some(target)) = (aliases.get(&edge.source), aliases.get(&edge.target))
        else {
            continue;
        };
        match edge.label.as_deref().filter(|label| !label.is_empty()) {
            Some(label) => output.push_str(&format!(
                "    {} -->|{}| {}\n",
                source,
                escape_mermaid(label),
                target
            )),
            None => output.push_str(&format!("    {} --> {}\n", source, target)),
        }
    }
    output
}

fn export_plantuml(architecture: &ProposedArchitecture) -> String {
    let (nodes, edges, aliases) = sorted_graph(architecture);
    let mut output = String::from("@startuml\nleft to right direction\n");
    output.push_str(&format!("title {}\n", escape_plantuml(&architecture.name)));
    for node in nodes {
        let alias = aliases.get(&node.id).expect("alias de nodo");
        let keyword = match node.node_type {
            NodeType::Actor => "actor",
            NodeType::ExternalSystem => "rectangle",
            NodeType::Container | NodeType::Module => "component",
            NodeType::Class | NodeType::Function => "component",
        };
        output.push_str(&format!(
            "{} \"{}\" as {}\n",
            keyword,
            escape_plantuml(&node.label),
            alias
        ));
    }
    for edge in edges {
        let (Some(source), Some(target)) = (aliases.get(&edge.source), aliases.get(&edge.target))
        else {
            continue;
        };
        if let Some(label) = edge.label.as_deref().filter(|label| !label.is_empty()) {
            output.push_str(&format!(
                "{} --> {} : {}\n",
                source,
                target,
                escape_plantuml(label)
            ));
        } else {
            output.push_str(&format!("{} --> {}\n", source, target));
        }
    }
    output.push_str("@enduml\n");
    output
}

fn export_structurizr(architecture: &ProposedArchitecture) -> String {
    let (nodes, edges, aliases) = sorted_graph(architecture);
    let description = architecture.description.as_deref().unwrap_or("");
    let mut output = format!(
        "workspace \"{}\" \"{}\" {{\n  model {{\n",
        escape_structurizr(&architecture.name),
        escape_structurizr(description)
    );
    for node in nodes {
        let alias = aliases.get(&node.id).expect("alias de nodo");
        let node_description = node
            .properties
            .get("description")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let element = if node.node_type == NodeType::Actor {
            "person"
        } else {
            "softwareSystem"
        };
        output.push_str(&format!(
            "    {} = {} \"{}\" \"{}\"\n",
            alias,
            element,
            escape_structurizr(&node.label),
            escape_structurizr(node_description)
        ));
    }
    for edge in edges {
        let (Some(source), Some(target)) = (aliases.get(&edge.source), aliases.get(&edge.target))
        else {
            continue;
        };
        let label = edge.label.as_deref().unwrap_or("relates to");
        output.push_str(&format!(
            "    {} -> {} \"{}\"\n",
            source,
            target,
            escape_structurizr(label)
        ));
    }
    output.push_str(
        "  }\n  views {\n    systemLandscape {\n      include *\n      autoLayout lr\n    }\n  }\n}\n",
    );
    output
}

fn escape_mermaid(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('|', "&#124;")
        .replace(['\r', '\n'], " ")
}

fn escape_plantuml(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], "\\n")
}

fn escape_structurizr(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], "\\n")
}
