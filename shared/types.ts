/**
 * SAAC v2.0 — Shared Type Definitions
 * ====================================
 *
 * Fuente única de verdad (Single Source of Truth) para el esquema del
 * Architecture Model Graph (AMG) y todas las entidades de dominio de SAAC.
 *
 * Este archivo es consumido por:
 *   - Frontend React (src/)
 *   - Worker Node.js (workers/node/)
 *   - Worker Python (vía JSON serializado, no importa directamente)
 *   - Backend Rust (vía serde JSON, no importa directamente)
 *
 * Referencia normativa: SAAC_v2.0_Especificacion_Tecnica.md
 *   - Capítulo 3: Architecture Model Graph (AMG)
 *   - Capítulo 4.3: Métricas Arquitectónicas
 *   - Capítulo 4.5: Detección de Estilos
 *   - Capítulo 4.6: Detección de Antipatrones
 *   - Capítulo 4.8: Análisis de Riesgos
 *   - Capítulo 4.9: Gestión de ADRs
 *   - Capítulo 7: Fitness Functions
 */

// ============================================================================
// ENUMS & UNION TYPES — Sección 3.3, 3.5, 4.5
// ============================================================================

/** Tipo de proyecto detectado por heurísticas del filesystem (§4.1) */
export type ProjectType = 'web' | 'server' | 'mobile' | 'desktop';

/** Estilo arquitectónico detectado — catálogo Richards & Ford (§4.5) */
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

/** Rol funcional inferido de un módulo dentro de la arquitectura (§3.5) */
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

/** Lenguajes soportados por los workers de análisis AST (§1.4) */
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

/** Tipos de nodo del AMG (§3.3.1) */
export type NodeType =
  | 'module'
  | 'container'
  | 'external-system'
  | 'actor'
  | 'class'
  | 'function';

/** Tipos de arista del AMG (§3.3.2) */
export type EdgeType =
  | 'dependency'
  | 'containment'
  | 'inheritance'
  | 'invocation'
  | 'external-call';

/** Tipo de dependencia entre módulos (§3.3.2) */
export type DependencyKind = 'import' | 'http-call' | 'db-access' | 'grpc' | 'messaging' | 'other';

/** Tipo de relación de herencia (§3.3.2) */
export type InheritanceKind = 'extends' | 'implements';

/** Protocolo de comunicación con sistemas externos (§3.3.2) */
export type ExternalProtocol = 'http' | 'https' | 'grpc' | 'graphql' | 'amqp' | 'kafka' | 'jdbc' | 'websocket' | 'other';

/** Visibilidad de miembros de clase (§4.2.1) */
export type Visibility = 'public' | 'private' | 'protected' | 'internal' | 'package';

/** Severidad de antipatrones y violaciones (§4.6, §7.3) */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Resultado de evaluación de una regla fitness (§7.3) */
export type RuleStatus = 'pass' | 'fail' | 'warning';

/** Tipo de snapshot del AMG (§3.4) */
export type SnapshotType = 'full' | 'delta';

/** Tipo de antipatrón detectado (§4.6) */
export type AntipatternType =
  | 'circular-dependency'
  | 'god-module'
  | 'layer-violation'
  | 'shotgun-surgery'
  | 'feature-envy'
  | 'lollipop-problem'
  | 'concrete-class-dependency';

/** Tipo de connascence estática (§4.3.5) */
export type ConnascenceType =
  | 'name'
  | 'type'
  | 'meaning'
  | 'algorithm'
  | 'position'
  | 'execution-order';

/** Estado de un ADR (§4.9.2 — formato MADR) */
export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded' | 'rejected';

/** Nivel de riesgo (§4.8) */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'negligible';

/** Tipo de plugin del sistema (§3.6.1) */
export type PluginKind = 'language' | 'metric' | 'diagram' | 'ai' | 'export' | 'rule';

// ============================================================================
// NODOS DEL AMG — Sección 3.3, 3.5
// ============================================================================

/**
 * Propiedades base compartidas por todo nodo del AMG (§3.3.3).
 * Permite operaciones genéricas de la UI: selección, anotación, historial.
 */
export interface AMGNodeBase {
  /** Identificador estable entre análisis (path normalizado o hash de firma) */
  id: string;
  /** Tipo de nodo (§3.3.1) */
  type: NodeType;
  /** Primer AnalysisRun donde apareció este nodo con este id */
  stableSince: string;
  /** Último AnalysisRun donde el nodo estuvo presente */
  lastSeenIn: string;
}

/**
 * ClassInfo — Clase o interfaz dentro de un Module (§3.3.1, §3.5).
 * Nodo de nivel C4-4 (Código).
 */
export interface ClassInfo {
  /** Namespace + nombre, estable entre versiones */
  id: string;
  name: string;
  /** Es clase abstracta o interfaz */
  isAbstract: boolean;
  /** Es interfaz */
  isInterface: boolean;
  visibility: Visibility;
  /** Métodos de la clase */
  methods: MethodInfo[];
  /** Atributos de la clase */
  attributes: AttributeInfo[];
  /** IDs de clases de las que hereda (extends) */
  extends: string[];
  /** IDs de interfaces que implementa */
  implements: string[];
  /** Métricas OOP a nivel de clase */
  metrics: ClassMetrics;
}

/**
 * Información de un método dentro de una clase (§4.2.1).
 */
export interface MethodInfo {
  name: string;
  visibility: Visibility;
  isStatic: boolean;
  isAbstract: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  /** Complejidad ciclomática del método */
  cyclomaticComplexity: number;
  /** Complejidad cognitiva (SonarSource) */
  cognitiveComplexity: number;
  /** Líneas de código del método */
  loc: number;
}

/**
 * Información de un parámetro de función/método.
 */
export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

/**
 * Información de un atributo de clase (§4.2.1).
 */
export interface AttributeInfo {
  name: string;
  type: string;
  visibility: Visibility;
  isStatic: boolean;
  isReadonly: boolean;
}

/**
 * FunctionInfo — Función standalone dentro de un Module (§3.3.1, §3.5).
 * Nodo de nivel C4-4 (Código).
 */
export interface FunctionInfo {
  /** Namespace + nombre, estable entre versiones */
  id: string;
  name: string;
  visibility: Visibility;
  isExported: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  /** Complejidad ciclomática (§4.3.3) */
  cyclomaticComplexity: number;
  /** Complejidad cognitiva (§4.3.3) */
  cognitiveComplexity: number;
  /** Líneas de código de la función */
  loc: number;
  /** IDs de funciones que esta función invoca (call graph, §3.3.2) */
  calls: string[];
}

// ============================================================================
// MÉTRICAS — Sección 4.3
// ============================================================================

/**
 * Métricas OOP a nivel de clase (§4.3.1, §4.3.2, §4.3.3).
 */
export interface ClassMetrics {
  /** Weighted Methods per Class — suma de CC de todos los métodos (§4.3.3) */
  wmc: number;
  /** Depth of Inheritance Tree (§4.3.3) */
  dit: number;
  /** Number of Children — subclases directas (§4.3.3) */
  noc: number;
  /** Coupling Between Objects (§4.3.1) */
  cbo: number;
  /** Response For a Class (§4.3.1) */
  rfc: number;
  /** Message Passing Coupling (§4.3.1) */
  mpc: number;
  /** Lack of Cohesion in Methods v4 (§4.3.2) */
  lcom4: number;
  /** Tight Class Cohesion (§4.3.2) */
  tcc: number;
  /** Loose Class Cohesion (§4.3.2) */
  lcc: number;
}

/**
 * Métricas de connascence de un módulo (§4.3.5).
 * Mide fuerza, localidad y grado del acoplamiento.
 */
export interface ConnascenceMetrics {
  /** Instancias de connascence de nombre */
  nameCount: number;
  /** Instancias de connascence de tipo */
  typeCount: number;
  /** Instancias de connascence de significado (magic numbers, etc.) */
  meaningCount: number;
  /** Instancias de connascence de algoritmo */
  algorithmCount: number;
  /** Resumen de fuerza total ponderada */
  totalStrength: number;
  /** Detalle de cada instancia detectada */
  instances: ConnascenceInstance[];
}

/**
 * Instancia individual de connascence detectada.
 */
export interface ConnascenceInstance {
  type: ConnascenceType;
  /** Fuerza de la connascence (1 = débil, 5 = fuerte) */
  strength: number;
  /** Localidad: 'intra-module' | 'inter-module' */
  locality: 'intra-module' | 'inter-module';
  /** Grado: número de elementos acoplados */
  degree: number;
  /** Módulos involucrados */
  involvedModuleIds: string[];
  /** Descripción human-readable */
  description: string;
}

/**
 * Métricas a nivel de módulo/archivo (§3.5, §4.3).
 * Estas son las métricas centrales de Richards & Ford.
 */
export interface ModuleMetrics {
  /** Afferent Coupling — módulos que dependen de este (§4.3.1) */
  ca: number;
  /** Efferent Coupling — módulos de los que este depende (§4.3.1) */
  ce: number;
  /** Instabilidad: Ce / (Ca + Ce). Rango [0,1] (§4.3.1) */
  instability: number;
  /** Abstractness: abstracciones / total. Rango [0,1] (§4.3.4) */
  abstractness: number;
  /** Distancia de la Secuencia Principal: |A + I - 1| (§4.3.4) */
  distance: number;
  /** LCOM4 a nivel de módulo (§4.3.2) */
  lcom4: number;
  /** Índice de Mantenibilidad 0-100 (§4.3) */
  maintainabilityIndex: number;
  /** Complejidad ciclomática promedio de todas las funciones (§4.3.3) */
  cyclomaticComplexityAvg: number;
  /** Complejidad ciclomática máxima entre funciones (§4.3.3) */
  cyclomaticComplexityMax: number;
  /** Cohesión de módulo: imports internos / (internos + externos) (§4.3.2) */
  moduleCohesion: number;
  /** Métricas de Connascence (§4.3.5), opcional */
  connascence?: ConnascenceMetrics;
  /** ID del Architecture Quantum al que pertenece (§4.3.6), opcional */
  quantumId?: string;
}

/**
 * WorkerModuleMetrics — Subconjunto de ModuleMetrics que un worker puede
 * calcular de forma aislada, sin acceso al grafo de dependencias completo.
 *
 * Las métricas de grafo (ca, instability, distance, moduleCohesion) requieren
 * conocer TODAS las aristas del proyecto, por lo que solo se computan en la
 * fase de agregación de Rust (engine/aggregator.rs) una vez que todos los
 * workers han reportado sus resultados.
 *
 * Este tipo se usa en:
 *   - WorkerAnalysisResult (respuesta worker → Rust)
 *   - Rust aggregator (antes de completar ModuleMetrics)
 */
export type WorkerModuleMetrics = Omit<
  ModuleMetrics,
  'ca' | 'instability' | 'distance' | 'moduleCohesion'
>;

/**
 * Métricas agregadas a nivel de proyecto completo (§3.5).
 */
export interface ProjectMetrics {
  /** Índice de mantenibilidad promedio ponderado */
  maintainabilityIndexAvg: number;
  /** Total de líneas de código */
  totalLoc: number;
  /** Total de líneas lógicas de código */
  totalLloc: number;
  /** Número total de módulos */
  totalModules: number;
  /** Número total de clases */
  totalClasses: number;
  /** Número total de funciones */
  totalFunctions: number;
  /** Número total de dependencias (aristas del grafo) */
  totalDependencies: number;
  /** Número de dependencias cíclicas detectadas */
  cyclicDependencyCount: number;
  /** Complejidad ciclomática promedio global */
  avgCyclomaticComplexity: number;
  /** Instabilidad promedio global */
  avgInstability: number;
  /** Abstractness promedio global */
  avgAbstractness: number;
  /** Distancia promedio de la secuencia principal */
  avgDistance: number;
  /** Número de Architecture Quanta detectados (§4.3.6) */
  quantumCount: number;
  /** Fitness Score global 0-100 (§7.3) */
  fitnessScore: number;
}

// ============================================================================
// MODULE — Nodo central del AMG — Sección 3.5
// ============================================================================

/**
 * Module — Archivo o unidad de compilación (§3.3.1, §3.5).
 * Es el nodo principal del AMG a nivel C4-3/C4-4.
 */
export interface Module extends AMGNodeBase {
  type: 'module';
  /** Nombre legible del módulo */
  name: string;
  /** Rol funcional inferido */
  moduleType: ModuleType;
  /** Lenguaje de programación del archivo */
  language: Language;
  /** Líneas de código totales */
  loc: number;
  /** Líneas lógicas de código (sin comentarios/blancos) */
  lloc: number;
  /** Clases/interfaces declaradas en este módulo */
  classes: ClassInfo[];
  /** Funciones standalone declaradas en este módulo */
  functions: FunctionInfo[];
  /** IDs de módulos que este importa */
  imports: string[];
  /** IDs de módulos que importan a este */
  importedBy: string[];
  /** Métricas arquitectónicas del módulo */
  metrics: ModuleMetrics;
}

// ============================================================================
// ARISTAS DEL AMG — Sección 3.3.2
// ============================================================================

/**
 * Dependency — Arista dirigida entre dos Module (§3.3.2, §3.5).
 */
export interface Dependency {
  /** ID del módulo origen */
  source: string;
  /** ID del módulo destino */
  target: string;
  /** Tipo de dependencia */
  kind: DependencyKind;
  /** Fuerza del acoplamiento (número de referencias) */
  weight: number;
}

/**
 * Invocation — Arista de llamada entre funciones (§3.3.2).
 * Para Call Graph y Sequence Diagrams.
 */
export interface Invocation {
  /** ID de la función que llama */
  caller: string;
  /** ID de la función llamada */
  callee: string;
}

/**
 * ExternalCall — Llamada de un módulo a un sistema externo (§3.3.2).
 */
export interface ExternalCall {
  /** ID del módulo que hace la llamada */
  moduleId: string;
  /** ID del sistema externo */
  externalSystemId: string;
  /** Protocolo usado */
  protocol: ExternalProtocol;
  /** Descripción de la acción (ej: "consulta usuarios") */
  description: string;
}

// ============================================================================
// NODOS DE NIVEL C4 — Sección 3.3.1, 3.5
// ============================================================================

/**
 * Container — Agrupación lógica de módulos, nivel C4-2 (§3.3.1, §4.4.2).
 */
export interface Container extends AMGNodeBase {
  type: 'container';
  name: string;
  /** Tecnología principal (ej: "React + TypeScript", "Spring Boot") */
  technology: string;
  /** Tipo de contenedor */
  containerType: 'api' | 'spa' | 'database' | 'queue' | 'cache' | 'worker' | 'mobile-app' | 'desktop-app' | 'other';
  /** Descripción funcional del contenedor */
  description: string;
  /** IDs de módulos que pertenecen a este contenedor */
  moduleIds: string[];
  /** Fuente de detección: archivo de config o inferencia */
  detectedFrom: string;
}

/**
 * ExternalSystem — Sistema externo detectado, nivel C4-1 (§3.3.1, §4.4.1).
 */
export interface ExternalSystem extends AMGNodeBase {
  type: 'external-system';
  name: string;
  description: string;
  /** Tipo de sistema externo */
  systemType: 'api' | 'database' | 'message-broker' | 'file-storage' | 'auth-provider' | 'cdn' | 'other';
  /** Protocolo de comunicación detectado */
  protocol: ExternalProtocol;
  /** SDK o librería usada para la conexión (ej: "aws-sdk", "stripe") */
  detectedVia: string;
}

/**
 * Actor — Usuario o rol que interactúa con el sistema, nivel C4-1 (§3.3.1, §4.4.1).
 */
export interface Actor extends AMGNodeBase {
  type: 'actor';
  name: string;
  /** Rol inferido desde endpoints/controllers */
  role: string;
  description: string;
}

// ============================================================================
// ANTIPATRONES — Sección 4.6
// ============================================================================

/**
 * Antipattern — Violación arquitectónica detectada (§4.6).
 */
export interface Antipattern {
  id: string;
  /** Tipo de antipatrón */
  antipatternType: AntipatternType;
  /** Nombre legible */
  name: string;
  /** Severidad del antipatrón */
  severity: Severity;
  /** Descripción del porqué es problemático */
  description: string;
  /** IDs de módulos afectados */
  affectedModuleIds: string[];
  /** Para ciclos: lista ordenada de IDs que forman el ciclo */
  cyclePath?: string[];
  /** Punto sugerido de ruptura (para ciclos) */
  suggestedBreakPoint?: string;
  /** Sugerencia de refactoring generada por IA */
  refactorSuggestion?: string;
  /** Si el usuario lo ha marcado como intencional */
  ignored: boolean;
  /** Justificación si fue ignorado */
  ignoreJustification?: string;
}

// ============================================================================
// DIAGRAMAS C4 — Sección 4.4
// ============================================================================

/**
 * Modelos C4 generados automáticamente desde el AMG (§4.4).
 */
export interface C4Models {
  /** Datos para diagrama de Contexto — nivel 1 */
  contextDiagram: C4DiagramData;
  /** Datos para diagrama de Contenedores — nivel 2 */
  containerDiagram: C4DiagramData;
  /** Datos para diagrama de Componentes — nivel 3 (uno por container) */
  componentDiagrams: Record<string, C4DiagramData>;
}

/**
 * Datos de un diagrama C4 individual.
 */
export interface C4DiagramData {
  /** Nodos del diagrama con posición y metadata */
  nodes: C4Node[];
  /** Relaciones dirigidas entre nodos */
  edges: C4Edge[];
}

/**
 * Nodo en un diagrama C4 (§4.4.6 — notación profesional).
 */
export interface C4Node {
  id: string;
  /** Nombre del elemento */
  label: string;
  /** Tipo de elemento: Persona, Sistema, Contenedor, Componente */
  elementType: string;
  /** Tecnología principal utilizada */
  technology: string;
  /** Descripción funcional breve */
  description: string;
  /** ID del nodo AMG correspondiente */
  amgNodeId?: string;
}

/**
 * Relación en un diagrama C4 (§4.4.6 — relaciones explícitas).
 */
export interface C4Edge {
  source: string;
  target: string;
  /** Acción: "consume", "envía eventos a", "consulta" */
  label: string;
  /** Protocolo: HTTP, gRPC, AMQP, etc. */
  protocol?: string;
}

// ============================================================================
// AMG PRINCIPAL — Sección 3.5 (referencia normativa)
// ============================================================================

/**
 * ArchitectureModelGraph — Representación serializada completa (§3.5).
 *
 * Esta es LA estructura central de SAAC. Todo módulo del sistema
 * (métricas, diagramas, IA, riesgos, fitness functions, historial, ADRs)
 * opera exclusivamente sobre esta estructura (§3.1).
 */
export interface ArchitectureModelGraph {
  /** Identificador único de esta versión del AMG */
  amgId: string;
  /** AnalysisRun que produjo este AMG */
  analysisRunId: string;
  /** Hash del path absoluto del proyecto */
  projectId: string;
  /** Nombre legible del proyecto */
  projectName: string;
  /** Tipo de proyecto detectado (§4.1) */
  detectedType: ProjectType;
  /** Estilo arquitectónico detectado (§4.5) */
  detectedStyle: ArchStyle;
  /** Confianza del estilo detectado, 0-1 */
  styleConfidence: number;
  /** Timestamp ISO 8601 del análisis */
  analyzedAt: string;
  /** AMG anterior en la cadena de versionado (null si es el primero) */
  parentAmgId: string | null;
  /** Tipo de snapshot: completo o delta incremental (§3.4) */
  snapshotType: SnapshotType;
  /** Todos los módulos (archivos/unidades de compilación) */
  modules: Module[];
  /** Grafo: aristas de dependencia entre módulos */
  dependencies: Dependency[];
  /** Agrupaciones nivel C4-2 */
  containers: Container[];
  /** Sistemas externos detectados */
  externalSystems: ExternalSystem[];
  /** Actores/usuarios inferidos */
  actors: Actor[];
  /** Llamadas a sistemas externos */
  externalCalls: ExternalCall[];
  /** Antipatrones arquitectónicos detectados */
  antipatterns: Antipattern[];
  /** Métricas agregadas del proyecto */
  metrics: ProjectMetrics;
  /** Modelos de diagramas C4 generados */
  c4Models: C4Models;
}

// ============================================================================
// VERSIONADO DEL AMG — Sección 3.4
// ============================================================================

/**
 * AMGDelta — Diferencia estructural entre dos AMG consecutivos (§3.4.1).
 * Se persiste para reconstruir cualquier AMG histórico.
 */
export interface AMGDelta {
  /** AMG de origen (versión anterior) */
  fromAmgId: string;
  /** AMG de destino (versión nueva) */
  toAmgId: string;
  /** Módulos nuevos que no existían en el AMG anterior */
  addedModules: Module[];
  /** IDs de módulos que ya no existen */
  removedModuleIds: string[];
  /** Módulos que cambiaron (métricas, aristas) */
  modifiedModules: ModifiedModule[];
  /** Dependencias nuevas */
  addedDependencies: Dependency[];
  /** Dependencias eliminadas */
  removedDependencies: Dependency[];
}

/**
 * Detalle de un módulo modificado entre dos versiones del AMG.
 */
export interface ModifiedModule {
  id: string;
  before: Partial<Module>;
  after: Partial<Module>;
}

// ============================================================================
// ENTIDADES DE DOMINIO A NIVEL DE PROYECTO — Sección 3.2
// ============================================================================

/**
 * Project — Entidad raíz del dominio (§3.2).
 * Un proyecto tiene exactamente un History y múltiples AnalysisRun.
 */
export interface Project {
  /** Hash del path absoluto */
  id: string;
  name: string;
  /** Path absoluto al directorio raíz */
  rootPath: string;
  /** Tipo detectado */
  detectedType: ProjectType;
  /** Frameworks detectados */
  detectedFrameworks: string[];
  /** Lenguajes detectados */
  detectedLanguages: Language[];
  /** Timestamp de creación (primer análisis) */
  createdAt: string;
  /** Timestamp del último análisis */
  lastAnalyzedAt: string;
}

/**
 * AnalysisRun — Una ejecución de análisis, ligada a un commit/hash (§3.2).
 * Cada AnalysisRun produce exactamente un AMG inmutable.
 */
export interface AnalysisRun {
  id: string;
  projectId: string;
  /** Timestamp ISO 8601 */
  startedAt: string;
  completedAt: string;
  /** Duración en milisegundos */
  durationMs: number;
  /** Hash del commit de git (si hay repositorio git) */
  gitCommitHash?: string;
  /** Rama de git activa */
  gitBranch?: string;
  /** ID del AMG producido */
  amgId: string;
  /** Tipo de snapshot generado */
  snapshotType: SnapshotType;
  /** Número de archivos analizados */
  filesAnalyzed: number;
  /** Número de archivos que cambiaron (para análisis incremental) */
  filesChanged: number;
  /** Si tuvo errores parciales */
  hasErrors: boolean;
  /** Errores encontrados durante el análisis */
  errors: AnalysisError[];
}

/**
 * Error ocurrido durante un análisis.
 */
export interface AnalysisError {
  /** Archivo que produjo el error */
  filePath: string;
  /** Worker que reportó el error */
  worker: 'node' | 'python';
  /** Mensaje de error */
  message: string;
  /** Si el error fue recuperable (el análisis continuó) */
  recoverable: boolean;
}

/**
 * AIReport — Reporte narrativo generado por IA para un AnalysisRun (§3.2, §4.7).
 */
export interface AIReport {
  id: string;
  analysisRunId: string;
  /** Modelo usado (ej: "qwen3:4b") */
  modelUsed: string;
  /** Resumen ejecutivo del proyecto */
  summary: string;
  /** Problemas principales detectados */
  mainIssues: string[];
  /** Recomendaciones priorizadas */
  recommendations: string[];
  /** Timestamp de generación */
  generatedAt: string;
  /** Tokens consumidos */
  tokensUsed: number;
}

// ============================================================================
// RIESGOS ARQUITECTÓNICOS — Sección 4.8
// ============================================================================

/**
 * Risk — Riesgo arquitectónico detectado o registrado manualmente (§3.2, §4.8).
 */
export interface Risk {
  id: string;
  projectId: string;
  /** Nombre del riesgo */
  name: string;
  /** Descripción detallada */
  description: string;
  /** Nivel de riesgo */
  level: RiskLevel;
  /** Probabilidad de materialización (0-1) */
  probability: number;
  /** Impacto si se materializa (0-1) */
  impact: number;
  /** Características arquitectónicas afectadas */
  affectedCharacteristics: string[];
  /** IDs de módulos relacionados */
  affectedModuleIds: string[];
  /** Si fue detectado automáticamente o registrado manualmente */
  source: 'auto' | 'manual';
  /** Mitigación propuesta */
  mitigation?: string;
  /** Timestamp de detección */
  detectedAt: string;
}

// ============================================================================
// DECISIONES ARQUITECTÓNICAS (ADRs) — Sección 4.9
// ============================================================================

/**
 * ADR — Architecture Decision Record en formato MADR (§3.2, §4.9).
 */
export interface ADR {
  id: string;
  projectId: string;
  /** Número secuencial del ADR */
  number: number;
  /** Título de la decisión */
  title: string;
  /** Estado del ADR */
  status: ADRStatus;
  /** Contexto: fuerzas, restricciones, necesidades */
  context: string;
  /** Decisión tomada */
  decision: string;
  /** Consecuencias: beneficios, limitaciones, trade-offs */
  consequences: string;
  /** Si fue generada automáticamente por IA o creada manualmente */
  source: 'ai-generated' | 'manual';
  /** Nivel de confianza de la inferencia (si fue generada por IA) */
  confidence?: number;
  /** Si la implementación actual cumple con esta decisión */
  complianceStatus: 'compliant' | 'non-compliant' | 'unknown';
  /** Timestamp de creación */
  createdAt: string;
  /** Timestamp de última actualización */
  updatedAt: string;
}

// ============================================================================
// ANOTACIONES — Sección 3.2
// ============================================================================

/**
 * Annotation — Nota de usuario sobre un elemento del AMG (§3.2).
 * Persiste en saac.annotations.json dentro del proyecto.
 */
export interface Annotation {
  id: string;
  /** ID del nodo del AMG anotado */
  targetNodeId: string;
  /** Tipo de nodo anotado */
  targetNodeType: NodeType;
  /** Contenido de la nota (Markdown) */
  content: string;
  /** Autor de la anotación */
  author?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FITNESS FUNCTIONS — Sección 7
// ============================================================================

/**
 * Rule — Regla arquitectónica definida en .saac/rules.yaml (§3.2, §7.2).
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  /** Tipo de regla */
  ruleType: 'threshold' | 'dependency' | 'no-cycles' | 'custom';
  /** Severidad si se viola */
  severity: Severity;
  /** Configuración específica de la regla */
  config: ThresholdRuleConfig | DependencyRuleConfig | NoCyclesRuleConfig;
  /** Si la regla está activa */
  enabled: boolean;
}

export interface ThresholdRuleConfig {
  type: 'threshold';
  /** Métrica a evaluar */
  metric: string;
  /** Operador de comparación */
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  /** Valor umbral */
  value: number;
  /** Scope: 'module' | 'class' | 'function' */
  scope: 'module' | 'class' | 'function';
}

export interface DependencyRuleConfig {
  type: 'dependency';
  /** Patrón glob del módulo origen */
  fromPattern: string;
  /** Patrón glob del módulo destino */
  toPattern: string;
  /** Si la dependencia está prohibida o requerida */
  mode: 'forbidden' | 'required';
}

export interface NoCyclesRuleConfig {
  type: 'no-cycles';
  /** Patrón glob del scope donde detectar ciclos */
  scope: string;
}

/**
 * RuleResult — Resultado de evaluar una regla contra el AMG (§7.3).
 */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  /** Estado de la evaluación */
  status: RuleStatus;
  severity: Severity;
  /** Mensaje human-readable del resultado */
  message: string;
  /** IDs de elementos que violan la regla */
  affectedElementIds: string[];
}

/**
 * FitnessEvaluation — Resultado de aplicar todas las Rules contra un AMG (§3.2, §7.3).
 */
export interface FitnessEvaluation {
  id: string;
  projectId: string;
  analysisRunId: string;
  amgId: string;
  /** Score global 0-100 */
  score: number;
  /** Resultados individuales por regla */
  results: RuleResult[];
  /** Timestamp de evaluación */
  evaluatedAt: string;
}

// ============================================================================
// HISTORIAL — Sección 3.2
// ============================================================================

/**
 * History — Colección ordenada de AnalysisRun para un proyecto (§3.2).
 */
export interface History {
  projectId: string;
  /** AnalysisRuns ordenados cronológicamente (más reciente último) */
  runs: AnalysisRun[];
  /** Total de runs almacenados */
  totalRuns: number;
}

// ============================================================================
// PLUGINS — Sección 3.6
// ============================================================================

/**
 * SaacPlugin — Contrato mínimo de un plugin (§3.6.2).
 */
export interface SaacPlugin {
  /** Identificador único, ej: "lang-zig" */
  id: string;
  /** Tipo de plugin */
  kind: PluginKind;
  /** Versión semver del plugin */
  version: string;
  /** Versión del contrato AMG que consume/produce */
  apiVersion: string;
  /** Capacidades del plugin, ej: ["parse", "extract-imports"] */
  capabilities: string[];
}

// ============================================================================
// PROTOCOLO DE COMUNICACIÓN WORKER ↔ RUST — Sección 6.3
// ============================================================================

/**
 * Comando enviado desde Rust al worker vía stdin (JSON Lines).
 */
export interface WorkerRequest {
  /** ID único de la solicitud (para correlacionar respuestas) */
  requestId: string;
  /** Tipo de comando */
  command: 'parse' | 'analyze' | 'extract-metrics' | 'detect-patterns' | 'shutdown';
  /** Payload específico del comando */
  payload: ParsePayload | AnalyzePayload;
}

export interface ParsePayload {
  /** Path absoluto del archivo a parsear */
  filePath: string;
  /** Lenguaje del archivo */
  language?: Language;
  /** Hash SHA256 del archivo (para cache invalidation) */
  fileHash?: string;
  /** Contenido del archivo (para evitar re-lectura en el worker) */
  content?: string;
}

export interface AnalyzePayload {
  /** Archivos del lote. Cada elemento conserva la misma forma que `parse`. */
  files: ParsePayload[];
  /** Configuración del proyecto (tsconfig paths, etc.) */
  projectConfig?: Record<string, unknown>;
}

/**
 * Respuesta enviada desde el worker a Rust vía stdout (JSON Lines).
 */
export interface WorkerResponse {
  /** ID de la solicitud original */
  requestId: string;
  /** Estado de la respuesta */
  status: 'success' | 'error' | 'partial';
  /** Datos del análisis (si success) */
  data?: WorkerAnalysisResult | WorkerBatchAnalysisResult;
  /** Mensaje de error (si error) */
  error?: string;
  /** Progreso (para operaciones largas) */
  progress?: WorkerProgress;
}

/**
 * Resultado de análisis de un archivo individual por el worker.
 */
export interface WorkerAnalysisResult {
  /** Módulo parcial generado (sin métricas de grafo como Ca/Ce) */
  module: Omit<Module, 'metrics'> & {
    metrics: WorkerModuleMetrics;
  };
  /** Dependencias descubiertas (imports resueltos) */
  dependencies: Dependency[];
  /** Invocaciones función → función descubiertas */
  invocations: Invocation[];
  /** Llamadas externas detectadas */
  externalCalls: ExternalCall[];
}

/** Resultado agregado de un comando `analyze`. */
export interface WorkerBatchAnalysisResult {
  results: WorkerFileAnalysisResult[];
}

/** Resultado aislado de un archivo dentro de un lote. */
export interface WorkerFileAnalysisResult {
  filePath: string;
  status: 'success' | 'parse_error';
  result?: WorkerAnalysisResult;
  errorMessage?: string;
}

/**
 * Progreso reportado por el worker durante un batch.
 */
export interface WorkerProgress {
  /** Archivos procesados hasta ahora */
  processed: number;
  /** Total de archivos en el batch */
  total: number;
  /** Archivo que se está procesando actualmente */
  currentFile: string;
}

// ============================================================================
// CONFIGURACIÓN DEL PROYECTO — Sección 7.2
// ============================================================================

/**
 * Configuración del proyecto SAAC (.saac/config.yaml).
 */
export interface SaacConfig {
  version: string;
  /** Umbrales de métricas */
  thresholds: MetricThresholds;
  /** Reglas de dependencia entre capas */
  dependencyRules: DependencyRuleConfig[];
  /** Configuración de IA */
  ai: AIConfig;
  /** Patrones a ignorar en el análisis */
  ignore: string[];
  /** Configuración de cache/purga */
  cache: CacheConfig;
}

export interface MetricThresholds {
  coupling: {
    maxEfferent: number;
    maxAfferent: number;
    maxCbo: number;
  };
  cohesion: {
    maxLcom4: number;
    minTcc: number;
  };
  complexity: {
    maxCyclomatic: number;
    maxCognitive: number;
    maxLocFunction: number;
    maxWmc: number;
  };
  maintainability: {
    minIndex: number;
    maxDistance: number;
  };
}

export interface AIConfig {
  /** Modelo Ollama a usar */
  model: string;
  /** Si la IA está habilitada */
  enabled: boolean;
  /** Si analiza automáticamente al abrir proyecto */
  autoAnalyze: boolean;
}

export interface CacheConfig {
  /** Máximo de AnalysisRun a conservar */
  maxRuns: number;
  /** Máximo de días a conservar */
  maxDays: number;
}

// ============================================================================
// ESTILOS ARQUITECTÓNICOS — Sección 4.5
// ============================================================================

/**
 * Resultado de detección de estilo arquitectónico (§4.5).
 */
export interface StyleDetectionResult {
  /** Estilo principal detectado */
  primaryStyle: ArchStyle;
  /** Confianza del estilo principal (0-1) */
  confidence: number;
  /** Estilos secundarios detectados con sus confianzas */
  secondaryStyles: { style: ArchStyle; confidence: number }[];
  /** Señales de detección encontradas */
  signals: StyleSignal[];
  /** Porcentaje de similitud con el modelo de referencia del estilo (isomorfismo) */
  isomorphismScore: number;
  /** Evaluación de superpoderes del estilo */
  superpowers: StyleSuperpower[];
}

/**
 * Señal individual usada para detectar un estilo (§4.5).
 */
export interface StyleSignal {
  /** Descripción de la señal */
  description: string;
  /** Estilo al que apunta */
  style: ArchStyle;
  /** Fuerza de la señal (0-1) */
  strength: number;
  /** Fuente de la señal (ej: "directorio controllers/ encontrado") */
  source: string;
}

/**
 * Evaluación de un superpoder arquitectónico (§4.5).
 */
export interface StyleSuperpower {
  /** Nombre del superpoder (ej: "Escalabilidad independiente") */
  name: string;
  /** Estilo al que pertenece */
  style: ArchStyle;
  /** Calificación 1-5 estrellas */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Justificación de la calificación */
  rationale: string;
}
