//! amg.rs — Architecture Model Graph (AMG): estructuras de datos centrales.
//!
//! Espejo en Rust de `shared/types.ts` (fuente única de verdad del esquema,
//! consumida también por el frontend React y, vía JSON, por los workers
//! Node/Python). La correspondencia de nombres de campo es intencional y
//! crítica: todo el pipeline (worker → stdout JSON → Rust → frontend)
//! depende de que las claves camelCase coincidan exactamente, de ahí el
//! `#[serde(rename_all = "camelCase")]` repetido en cada struct.
//!
//! ## Alcance de este archivo
//!
//! Solo las estructuras de datos y sus (de)serializaciones. La lógica de
//! construcción de un AMG completo vive en `aggregator.rs` — y ese archivo
//! NO produce un `ArchitectureModelGraph` completo todavía: le faltan
//! `amgId`/`analysisRunId`/`projectId`/timestamps (responsabilidad de quien
//! orqueste el análisis, hoy `commands/analysis.rs`, sin tocar en este
//! pase) y los detectores de Containers/ExternalSystems/Actors/
//! Antipatterns/C4 (§4.4, §4.6 — no implementados aún, fuera de alcance).
//! Ver el docstring de `aggregator.rs` para el detalle exacto de qué SÍ
//! calcula.
//!
//! ## Discrepancias detectadas contra `shared/types.ts` (revisar)
//!
//! Al auditar el JSON real que emiten los 6 parsers Python
//! (workers/python/parsers/*.py) contra este esquema, aparecieron campos
//! que TODOS los parsers envían de forma consistente pero que
//! `shared/types.ts` no declara:
//!   - `MethodInfo`: `isAsync`, `isConstructor`, `decorators` (los 6
//!     parsers los emiten siempre).
//!   - `ParameterInfo`: `isVariadic` (los 6 parsers lo emiten).
//!   - `ClassInfo`: `decorators` (Java/C#/Kotlin/Swift emiten anotaciones/
//!     atributos a nivel de clase).
//!
//! Se decidió modelar estos structs contra el JSON REAL (que es unánime
//! entre los 6 lenguajes, así que es la fuente de verdad de facto) en vez
//! de truncar esos campos para calzar con el `.ts` desactualizado. Recomendado:
//! actualizar `shared/types.ts` para que el frontend también pueda leerlos.
//!
//! Deliberadamente NO promovidos al esquema genérico (por ser conceptos que
//! no generalizan entre lenguajes): `isEnum`/`isStruct`/`isExtension` que
//! emiten swift.py/rust.py/go.py sobre `ClassInfo`. Al no existir esos
//! campos en `ClassInfo` aquí, serde los ignora silenciosamente al
//! deserializar (comportamiento default sin `deny_unknown_fields`) — es
//! intencional, no un olvido.
//!
//! `FunctionInfo` (función standalone) SÍ tiene un mismatch real y no
//! trivial: `go.py` y `rust.py` actualmente reutilizan la forma de
//! `MethodInfo` para sus funciones top-level (les falta `id` y
//! `isExported`, y sobran `isStatic`/`isAbstract`/`isConstructor`, que no
//! tienen sentido en una función libre). Deserializar `Module.functions`
//! de un archivo Go o Rust real FALLARÁ contra el `FunctionInfo` de abajo
//! (modelado correctamente contra el spec) hasta que se corrija la forma
//! emitida por esos dos parsers. Pendiente, fuera de este pase.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// ENUMS — §3.3, 3.5, 4.5 de la especificación técnica
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectType {
    Web,
    Server,
    Mobile,
    Desktop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArchStyle {
    Layered,
    ModularMonolith,
    Microservices,
    Hexagonal,
    EventDriven,
    Microkernel,
    Cqrs,
    BigBallOfMud,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModuleType {
    Controller,
    Service,
    Repository,
    Model,
    Util,
    Config,
    Middleware,
    Dto,
    Factory,
    UiComponent,
    Hook,
    Store,
    Test,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Typescript,
    Javascript,
    Python,
    Java,
    Kotlin,
    Csharp,
    Swift,
    Go,
    Rust,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeType {
    Module,
    Container,
    ExternalSystem,
    Actor,
    Class,
    Function,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EdgeType {
    Dependency,
    Containment,
    Inheritance,
    Invocation,
    ExternalCall,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DependencyKind {
    Import,
    #[serde(rename = "http-call")]
    HttpCall,
    #[serde(rename = "db-access")]
    DbAccess,
    Grpc,
    Messaging,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InheritanceKind {
    Extends,
    Implements,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExternalProtocol {
    Http,
    Https,
    Grpc,
    Graphql,
    Amqp,
    Kafka,
    Jdbc,
    Websocket,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    Public,
    Private,
    Protected,
    Internal,
    Package,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SnapshotType {
    Full,
    Delta,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AntipatternType {
    CircularDependency,
    GodModule,
    LayerViolation,
    ShotgunSurgery,
    FeatureEnvy,
    LollipopProblem,
    ConcreteClassDependency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConnascenceType {
    Name,
    #[serde(rename = "type")]
    Type,
    Meaning,
    Algorithm,
    Position,
    ExecutionOrder,
}

// ============================================================================
// NODOS DE NIVEL CLASE / FUNCIÓN — §3.3.1, 4.2.1
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub is_optional: bool,
    /// No está en `shared/types.ts` todavía — ver discrepancias arriba.
    #[serde(default)]
    pub is_variadic: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub visibility: Visibility,
    pub is_static: bool,
    pub is_readonly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodInfo {
    pub name: String,
    pub visibility: Visibility,
    pub is_static: bool,
    pub is_abstract: bool,
    /// No está en `shared/types.ts` todavía — ver discrepancias arriba.
    #[serde(default)]
    pub is_async: bool,
    /// No está en `shared/types.ts` todavía — ver discrepancias arriba.
    #[serde(default)]
    pub is_constructor: bool,
    pub parameters: Vec<ParameterInfo>,
    pub return_type: String,
    pub cyclomatic_complexity: u32,
    pub cognitive_complexity: u32,
    pub loc: u32,
    /// No está en `shared/types.ts` todavía — ver discrepancias arriba.
    #[serde(default)]
    pub decorators: Vec<String>,
}

/// Función standalone dentro de un `Module` (§3.3.1, §3.5).
///
/// ⚠️ Ver discrepancias arriba: `go.py` y `rust.py` NO emiten este shape
/// todavía para sus funciones top-level (emiten forma de `MethodInfo`) —
/// deserializar sus `Module.functions` fallará hasta corregir esos parsers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInfo {
    pub id: String,
    pub name: String,
    pub visibility: Visibility,
    pub is_exported: bool,
    pub parameters: Vec<ParameterInfo>,
    pub return_type: String,
    pub cyclomatic_complexity: u32,
    pub cognitive_complexity: u32,
    pub loc: u32,
    /// IDs de funciones invocadas (call graph, §3.3.2). Ningún parser lo
    /// implementa todavía — siempre llega `[]`.
    #[serde(default)]
    pub calls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassInfo {
    pub id: String,
    pub name: String,
    pub is_abstract: bool,
    pub is_interface: bool,
    pub visibility: Visibility,
    pub methods: Vec<MethodInfo>,
    pub attributes: Vec<AttributeInfo>,
    /// IDs (hoy: nombres sin resolver — ver aggregator.rs) de clases de las
    /// que hereda.
    pub extends: Vec<String>,
    /// IDs (hoy: nombres sin resolver) de interfaces que implementa.
    pub implements: Vec<String>,
    /// No está en `shared/types.ts` todavía — ver discrepancias arriba.
    #[serde(default)]
    pub decorators: Vec<String>,
    pub metrics: ClassMetrics,
}

// ============================================================================
// MÉTRICAS — §4.3
// ============================================================================

/// Métricas OOP a nivel de clase (§4.3.1, §4.3.2, §4.3.3).
///
/// ⚠️ Los workers Python solo tienen CONFIRMADO en este research que
/// calculan `lcom4` (y lo usan para derivar `cbo` en algunos casos). El
/// resto de campos (`wmc`, `dit`, `noc`, `rfc`, `mpc`, `tcc`, `lcc`) se
/// modelan aquí con `#[serde(default)]` (caen a 0/0.0 si el worker no los
/// envía) para no romper la deserialización mientras se confirma el shape
/// exacto que devuelve `metrics/cohesion.py::calculate_class_metrics`.
/// `dit`/`noc` en particular, calculados por archivo, son como mucho una
/// aproximación local (no resuelven jerarquías cross-archivo) — no hay
/// resolución global de herencia implementada en ningún punto del pipeline
/// todavía.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassMetrics {
    #[serde(default)]
    pub wmc: u32,
    #[serde(default)]
    pub dit: u32,
    #[serde(default)]
    pub noc: u32,
    #[serde(default)]
    pub cbo: u32,
    #[serde(default)]
    pub rfc: u32,
    #[serde(default)]
    pub mpc: u32,
    #[serde(default)]
    pub lcom4: u32,
    #[serde(default)]
    pub tcc: f64,
    #[serde(default)]
    pub lcc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnascenceInstance {
    #[serde(rename = "type")]
    pub connascence_type: ConnascenceType,
    pub strength: u8,
    pub locality: ConnascenceLocality,
    pub degree: u32,
    pub involved_module_ids: Vec<String>,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConnascenceLocality {
    IntraModule,
    InterModule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnascenceMetrics {
    pub name_count: u32,
    pub type_count: u32,
    pub meaning_count: u32,
    pub algorithm_count: u32,
    pub total_strength: f64,
    pub instances: Vec<ConnascenceInstance>,
}

/// Subconjunto de `ModuleMetrics` que un worker puede calcular en
/// aislamiento, sin ver el resto del proyecto — espejo de
/// `WorkerModuleMetrics` (`Omit<ModuleMetrics, 'ca'|'instability'|
/// 'distance'|'moduleCohesion'>`) en `shared/types.ts`. Confirmado 1:1
/// contra el JSON real de los 6 parsers Python.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerModuleMetrics {
    pub ce: u32,
    pub abstractness: f64,
    /// Placeholder fijo en `1` en todos los parsers actuales — LCOM4 a
    /// nivel de módulo no está implementado, solo a nivel de clase.
    pub lcom4: u32,
    pub maintainability_index: f64,
    pub cyclomatic_complexity_avg: f64,
    pub cyclomatic_complexity_max: u32,
    #[serde(default)]
    pub connascence: Option<ConnascenceMetrics>,
    #[serde(default)]
    pub quantum_id: Option<String>,
}

/// Métricas completas a nivel de módulo/archivo (§3.5, §4.3) — solo
/// calculable tras ver TODO el proyecto (`aggregator.rs` añade
/// `ca`/`instability`/`distance`/`moduleCohesion` a un `WorkerModuleMetrics`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleMetrics {
    pub ca: u32,
    pub ce: u32,
    pub instability: f64,
    pub abstractness: f64,
    pub distance: f64,
    pub lcom4: u32,
    pub maintainability_index: f64,
    pub cyclomatic_complexity_avg: f64,
    pub cyclomatic_complexity_max: u32,
    pub module_cohesion: f64,
    #[serde(default)]
    pub connascence: Option<ConnascenceMetrics>,
    #[serde(default)]
    pub quantum_id: Option<String>,
}

impl ModuleMetrics {
    /// Completa un `WorkerModuleMetrics` (parcial, calculado por el worker
    /// en aislamiento) con las métricas de grafo que solo el agregador
    /// puede calcular, produciendo el `ModuleMetrics` final.
    ///
    /// ⚠️ Nota deliberada: `ce` NO se toma de `worker.ce`. El worker lo
    /// calcula como "total de imports del archivo, internos + externos"
    /// (única cuenta posible sin ver el resto del proyecto), pero el
    /// comentario de este mismo esquema en `shared/types.ts` define `ce`
    /// como *"módulos de los que este depende"* — la definición clásica de
    /// Efferent Coupling de Robert C. Martin es puramente sobre
    /// componentes INTERNOS del mismo diseño, no sobre librerías externas.
    /// `aggregator.rs` recalcula `ce` (y `ca`) contando solo aristas
    /// resueltas contra otros módulos conocidos del proyecto, y ese valor
    /// reemplaza al del worker aquí. Ver el docstring de `aggregator.rs`
    /// para el detalle y la justificación completa de esta decisión.
    pub fn from_worker(
        worker: WorkerModuleMetrics,
        ca: u32,
        ce: u32,
        instability: f64,
        distance: f64,
        module_cohesion: f64,
    ) -> Self {
        ModuleMetrics {
            ca,
            ce,
            instability,
            abstractness: worker.abstractness,
            distance,
            lcom4: worker.lcom4,
            maintainability_index: worker.maintainability_index,
            cyclomatic_complexity_avg: worker.cyclomatic_complexity_avg,
            cyclomatic_complexity_max: worker.cyclomatic_complexity_max,
            module_cohesion,
            connascence: worker.connascence,
            quantum_id: worker.quantum_id,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetrics {
    pub maintainability_index_avg: f64,
    pub total_loc: u32,
    pub total_lloc: u32,
    pub total_modules: u32,
    pub total_classes: u32,
    pub total_functions: u32,
    pub total_dependencies: u32,
    pub cyclic_dependency_count: u32,
    pub avg_cyclomatic_complexity: f64,
    pub avg_instability: f64,
    pub avg_abstractness: f64,
    pub avg_distance: f64,
    pub quantum_count: u32,
    pub fitness_score: f64,
}

// ============================================================================
// MODULE — nodo central del AMG — §3.5
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub name: String,
    pub module_type: ModuleType,
    pub language: Language,
    pub loc: u32,
    pub lloc: u32,
    pub classes: Vec<ClassInfo>,
    pub functions: Vec<FunctionInfo>,
    pub imports: Vec<String>,
    pub imported_by: Vec<String>,
    pub stable_since: String,
    pub last_seen_in: String,
    pub metrics: ModuleMetrics,
}

/// Espejo de `Omit<Module, 'metrics'> & { metrics: WorkerModuleMetrics }`
/// en `shared/types.ts` — la forma REAL en la que un worker reporta un
/// módulo, antes de que `aggregator.rs` complete las métricas de grafo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerModule {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub name: String,
    pub module_type: ModuleType,
    pub language: Language,
    pub loc: u32,
    pub lloc: u32,
    pub classes: Vec<ClassInfo>,
    pub functions: Vec<FunctionInfo>,
    pub imports: Vec<String>,
    #[serde(default)]
    pub imported_by: Vec<String>,
    #[serde(default)]
    pub stable_since: String,
    #[serde(default)]
    pub last_seen_in: String,
    pub metrics: WorkerModuleMetrics,
}

// ============================================================================
// ARISTAS DEL AMG — §3.3.2
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub source: String,
    pub target: String,
    pub kind: DependencyKind,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invocation {
    #[serde(alias = "caller")]
    pub source: String,
    #[serde(alias = "callee")]
    pub target: String,
    #[serde(default = "default_call_kind")]
    pub kind: String,
    #[serde(default = "default_weight")]
    pub weight: u32,
}

fn default_call_kind() -> String {
    "call".to_string()
}

fn default_weight() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCall {
    pub module_id: String,
    pub external_system_id: String,
    pub protocol: ExternalProtocol,
    pub description: String,
}

// ============================================================================
// PROTOCOLO WORKER → RUST — resultado de análisis de UN archivo
// ============================================================================

/// Espejo de `WorkerAnalysisResult` en `shared/types.ts` — lo que hay
/// dentro de `FileAnalysisOutcome.result: Option<Value>`
/// (`workers/types.rs`) una vez parseado ese `Value` contra este struct.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerAnalysisResult {
    pub module: WorkerModule,
    #[serde(default)]
    pub dependencies: Vec<Dependency>,
    #[serde(default)]
    pub invocations: Vec<Invocation>,
    #[serde(default)]
    pub external_calls: Vec<ExternalCall>,
}

// ============================================================================
// NODOS DE NIVEL C4 — §3.3.1, 3.5 (placeholders — detectores no implementados)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContainerType {
    Api,
    Spa,
    Database,
    Queue,
    Cache,
    Worker,
    MobileApp,
    DesktopApp,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Container {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub stable_since: String,
    pub last_seen_in: String,
    pub name: String,
    pub technology: String,
    pub container_type: ContainerType,
    pub description: String,
    pub module_ids: Vec<String>,
    pub detected_from: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExternalSystemType {
    Api,
    Database,
    MessageBroker,
    FileStorage,
    AuthProvider,
    Cdn,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalSystem {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub stable_since: String,
    pub last_seen_in: String,
    pub name: String,
    pub description: String,
    pub system_type: ExternalSystemType,
    pub protocol: ExternalProtocol,
    pub detected_via: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub stable_since: String,
    pub last_seen_in: String,
    pub name: String,
    pub role: String,
    pub description: String,
}

// ============================================================================
// ANTIPATRONES — §4.6 (placeholder — detector no implementado)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Antipattern {
    pub id: String,
    pub antipattern_type: AntipatternType,
    pub name: String,
    pub severity: Severity,
    pub description: String,
    pub affected_module_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cycle_path: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_break_point: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refactor_suggestion: Option<String>,
    pub ignored: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ignore_justification: Option<String>,
}

// ============================================================================
// DIAGRAMAS C4 — §4.4 (placeholder — generador no implementado)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct C4Node {
    pub id: String,
    pub label: String,
    pub element_type: String,
    pub technology: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amg_node_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct C4Edge {
    pub source: String,
    pub target: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct C4DiagramData {
    #[serde(default)]
    pub nodes: Vec<C4Node>,
    #[serde(default)]
    pub edges: Vec<C4Edge>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct C4Models {
    #[serde(default)]
    pub context_diagram: C4DiagramData,
    #[serde(default)]
    pub container_diagram: C4DiagramData,
    #[serde(default)]
    pub component_diagrams: HashMap<String, C4DiagramData>,
}

// ============================================================================
// AMG PRINCIPAL — §3.5
// ============================================================================

/// Representación serializada completa del AMG (§3.5).
///
/// `aggregator.rs` NO construye este struct directamente — devuelve un
/// `AggregatedProject` más liviano (solo `modules`/`dependencies`/
/// `metrics`/estilo detectado) porque no tiene ni la autoridad ni la
/// información (IDs, timestamps, versionado) para rellenar el resto. Ver
/// el docstring de `aggregator.rs`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectureModelGraph {
    pub amg_id: String,
    pub analysis_run_id: String,
    pub project_id: String,
    pub project_name: String,
    pub detected_type: ProjectType,
    pub detected_style: ArchStyle,
    pub style_confidence: f64,
    pub analyzed_at: String,
    pub parent_amg_id: Option<String>,
    pub snapshot_type: SnapshotType,
    pub modules: Vec<Module>,
    pub dependencies: Vec<Dependency>,
    #[serde(default)]
    pub containers: Vec<Container>,
    #[serde(default)]
    pub external_systems: Vec<ExternalSystem>,
    #[serde(default)]
    pub actors: Vec<Actor>,
    #[serde(default)]
    pub external_calls: Vec<ExternalCall>,
    #[serde(default)]
    pub antipatterns: Vec<Antipattern>,
    pub metrics: ProjectMetrics,
    #[serde(default)]
    pub c4_models: C4Models,
}
