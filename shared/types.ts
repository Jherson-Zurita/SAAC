/**
 * SAAC v2.0 — Shared Type Definitions
 * ====================================
 * Fuente única de verdad para el esquema del Architecture Model Graph (AMG)
 * y todas las entidades de dominio expuestas por el backend de Rust.
 */

// ── ENUMS & UNION TYPES ──

export type ProjectType = 'web' | 'server' | 'mobile' | 'desktop';

export type ArchStyle =
  | 'layered'
  | 'modular-monolith'
  | 'microservices'
  | 'hexagonal'
  | 'event-driven'
  | 'microkernel'
  | 'cqrs'
  | 'big-ball-of-mud'
  | 'unknown';

export type ModuleType =
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'util'
  | 'config'
  | 'middleware'
  | 'dto'
  | 'factory'
  | 'ui-component'
  | 'hook'
  | 'store'
  | 'test'
  | 'unknown';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'csharp'
  | 'swift'
  | 'go'
  | 'rust';

export type NodeType =
  | 'module'
  | 'container'
  | 'external-system'
  | 'actor'
  | 'class'
  | 'function';

export type EdgeType =
  | 'dependency'
  | 'containment'
  | 'inheritance'
  | 'invocation'
  | 'external-call';

export type DependencyKind = 'import' | 'http-call' | 'db-access' | 'grpc' | 'messaging' | 'other';
export type InheritanceKind = 'extends' | 'implements';
export type ExternalProtocol = 'http' | 'https' | 'grpc' | 'graphql' | 'amqp' | 'kafka' | 'jdbc' | 'websocket' | 'other';
export type Visibility = 'public' | 'private' | 'protected' | 'internal' | 'package';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RuleStatus = 'pass' | 'fail' | 'warning';
export type SnapshotType = 'full' | 'delta';

export type AntipatternType =
  | 'circular-dependency'
  | 'god-module'
  | 'layer-violation'
  | 'shotgun-surgery'
  | 'feature-envy'
  | 'lollipop-problem'
  | 'concrete-class-dependency';

// ── ESTRUCTURAS DEL AMG Y DETALLES DE CÓDIGO ──

export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface AttributeInfo {
  name: string;
  type: string;
  visibility: Visibility;
  isStatic: boolean;
  isReadonly: boolean;
}

export interface MethodInfo {
  name: string;
  visibility: Visibility;
  isStatic: boolean;
  isAbstract: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  loc: number;
}

export interface ClassMetrics {
  wmc: number;
  dit: number;
  noc: number;
  cbo: number;
  rfc: number;
  mpc: number;
  lcom4: number;
  tcc: number;
  lcc: number;
}

export interface ClassInfo {
  id: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  visibility: Visibility;
  methods: MethodInfo[];
  attributes: AttributeInfo[];
  extends: string[];
  implements: string[];
  metrics: ClassMetrics;
}

export interface FunctionInfo {
  id: string;
  name: string;
  visibility: Visibility;
  isExported: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  loc: number;
  calls: string[];
}

export interface ModuleMetrics {
  ca: number;
  ce: number;
  instability: number;
  abstractness: number;
  distance: number;
  lcom4: number;
  maintainabilityIndex: number;
  cyclomaticComplexityAvg: number;
  cyclomaticComplexityMax: number;
  moduleCohesion: number;
}

export interface ProjectMetrics {
  maintainabilityIndexAvg: number;
  totalLoc: number;
  totalLloc: number;
  totalModules: number;
  totalClasses: number;
  totalFunctions: number;
  totalDependencies: number;
  cyclicDependencyCount: number;
  avgCyclomaticComplexity: number;
  avgInstability: number;
  avgAbstractness: number;
  avgDistance: number;
  quantumCount: number;
  fitnessScore: number;
}

export interface Module {
  id: string;
  name: string;
  type: 'module';
  moduleType: ModuleType;
  language: Language;
  loc: number;
  lloc: number;
  classes: ClassInfo[];
  functions: FunctionInfo[];
  imports: string[];
  importedBy: string[];
  metrics: ModuleMetrics;
}

export interface Dependency {
  source: string;
  target: string;
  kind: DependencyKind;
  weight: number;
}

export interface Invocation {
  caller: string;
  callee: string;
}

export interface ExternalCall {
  moduleId: string;
  externalSystemId: string;
  protocol: ExternalProtocol;
  description: string;
}

export interface Container {
  id: string;
  name: string;
  type: 'container';
  technology: string;
  containerType: 'api' | 'spa' | 'database' | 'queue' | 'cache' | 'worker' | 'mobile-app' | 'desktop-app' | 'other';
  description: string;
  moduleIds: string[];
  detectedFrom: string;
}

export interface ExternalSystem {
  id: string;
  name: string;
  type: 'external-system';
  description: string;
  systemType: 'api' | 'database' | 'message-broker' | 'file-storage' | 'auth-provider' | 'cdn' | 'other';
  protocol: ExternalProtocol;
  detectedVia: string;
}

export interface Actor {
  id: string;
  name: string;
  type: 'actor';
  role: string;
  description: string;
}

export interface Antipattern {
  id: string;
  antipatternType: AntipatternType;
  name: string;
  severity: Severity;
  description: string;
  affectedModuleIds: string[];
  cyclePath?: string[];
  suggestedBreakPoint?: string;
  refactorSuggestion?: string;
  ignored: boolean;
  ignoreJustification?: string;
}

export interface C4Node {
  id: string;
  label: string;
  elementType: string;
  technology: string;
  description: string;
  amgNodeId?: string;
}

export interface C4Edge {
  source: string;
  target: string;
  label: string;
  protocol?: string;
}

export interface C4DiagramData {
  nodes: C4Node[];
  edges: C4Edge[];
}

export interface C4Models {
  contextDiagram: C4DiagramData;
  containerDiagram: C4DiagramData;
  componentDiagrams: Record<string, C4DiagramData>;
}

export interface ArchitectureModelGraph {
  amgId: string;
  analysisRunId: string;
  projectId: string;
  projectName: string;
  detectedType: ProjectType;
  detectedStyle: ArchStyle;
  styleConfidence: number;
  analyzedAt: string;
  parentAmgId: string | null;
  snapshotType: SnapshotType;
  modules: Module[];
  dependencies: Dependency[];
  containers: Container[];
  externalSystems: ExternalSystem[];
  actors: Actor[];
  externalCalls: ExternalCall[];
  antipatterns: Antipattern[];
  metrics: ProjectMetrics;
  c4Models: C4Models;
}

// ── ESTRUCTURAS DE ANÁLISIS & EVENTOS ──

export type AnalysisFileStatus = 'success' | 'timeout' | 'worker_crashed' | 'parse_error' | 'worker_unavailable';

export interface SkippedFile {
  filePath: string;
  reason: string;
}

export interface FileAnalysisOutcome {
  filePath: string;
  status: AnalysisFileStatus;
  result?: unknown;
  errorMessage?: string;
}

export interface ProjectAnalysisResult {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  outcomes: FileAnalysisOutcome[];
  skippedFiles: SkippedFile[];
  durationMs: number;
  cancelled: boolean;
  amg?: ArchitectureModelGraph;
}

export interface ProjectProgressEvent {
  phase: string;
  totalFiles: number;
  completedFiles: number;
  nodeFiles: number;
  pythonFiles: number;
  skippedFiles: number;
  currentFile: string | null;
}

// ── MÓDULOS PRE-FRONTEND 1 a 6 ──

// Módulo 1: Configuración de Proyecto & Ignorados
export interface ProjectConfig {
  ignorePatterns: string[];
  ignoreExtensions: string[];
  maxFileSizeMb: number;
}

// Módulo 2: Consola SAAC & Logs
export interface LogEvent {
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
  target: string;
  message: string;
}

export interface ConsoleCommandOutput {
  command: string;
  success: boolean;
  message: string;
  data?: unknown;
}

// Módulo 3: Anotaciones, ADRs, Riesgos y Antipatrones Ignorados
export interface Annotation {
  id: string;
  targetId: string;
  targetType: 'module' | 'class' | 'function' | 'c4_node';
  title: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Adr {
  id: string;
  number: number;
  title: string;
  status: 'Proposed' | 'Accepted' | 'Rejected' | 'Deprecated' | 'Superseded';
  context: string;
  decision: string;
  consequences: string;
  date: string;
  author: string;
}

export interface IgnoredAntipattern {
  antipatternId: string;
  ignoredAt: string;
  justification: string;
  author: string;
}

export interface Risk {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  mitigation: string;
  affectedModuleIds: string[];
}

export interface ProjectAnnotations {
  annotations: Annotation[];
  adrs: Adr[];
  ignoredAntipatterns: IgnoredAntipattern[];
  risks: Risk[];
}

// Módulo 4: Motor de Reglas (Fitness Score Configurable)
export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  enabled: boolean;
  condition: string;
}

export interface RuleConfig {
  rules: Rule[];
}

export interface RuleEvaluationItem {
  ruleId: string;
  ruleName: string;
  severity: string;
  passed: boolean;
  score: number;
  weight: number;
  message: string;
}

export interface FitnessEvaluationResult {
  fitnessScore: number;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  evaluations: RuleEvaluationItem[];
}

// Módulo 5: Historial y Versionado AMG
export interface AnalysisRunSummary {
  runId: string;
  timestamp: string;
  totalFiles: number;
  successful: number;
  failed: number;
  durationMs: number;
  moduleCount: number;
  dependencyCount: number;
  antipatternCount: number;
  fitnessScore: number;
}

export interface AnalysisHistory {
  runs: AnalysisRunSummary[];
}

export interface AMGDelta {
  runIdA: string;
  runIdB: string;
  timestampA: string;
  timestampB: string;
  addedModules: string[];
  removedModules: string[];
  modifiedModules: string[];
  addedDependenciesCount: number;
  removedDependenciesCount: number;
  metricsDiff: Record<string, number>;
}

// Módulo 6: Configuración Global
export interface GlobalConfig {
  aiProvider: string;
  aiEndpoint: string;
  aiDefaultModel: string;
  maxWorkerThreads: number;
  defaultTheme: string;
  autoCheckAi: boolean;
}

// IA Status
export interface AiStatusResult {
  available: boolean;
  provider: string;
  endpoint: string;
  model: string;
  message: string;
}
