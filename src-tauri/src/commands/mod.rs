// src/commands/mod.rs
pub mod ai;
pub mod analysis;
pub mod design;
pub mod pre_frontend;
pub mod project;

// Reexportar módulos de engine
pub use crate::engine::aggregator;
pub use crate::engine::amg;
pub use crate::engine::cache;
pub use crate::engine::java_source_roots;
pub use crate::engine::project_detector;
