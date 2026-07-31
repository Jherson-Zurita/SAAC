mod comparison;
mod export;
mod model;
mod storage;

pub use comparison::compare_proposed_architecture;
pub use export::{export_architecture, export_proposed_architecture};
pub use model::{
    CanvasLayout, ComparisonReport, DesignSnapshot, ExportFormat, NodeDiff, NodeOrigin,
    NodePosition, ProposedArchitecture, ProposedArchitectureSummary, ProposedEdge, ProposedNode,
    DESIGN_SCHEMA_VERSION,
};
pub use storage::{DesignError, DesignManager};

#[cfg(test)]
mod tests;
