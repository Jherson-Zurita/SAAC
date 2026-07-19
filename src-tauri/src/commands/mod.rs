// src/commands/mod.rs
pub mod analysis;
pub mod project;
pub mod ai;

// Reexportar módulos de engine
pub use crate::engine::project_detector;
pub use crate::engine::amg;
pub use crate::engine::cache;
pub use crate::engine::aggregator;
pub use crate::engine::java_source_roots;
