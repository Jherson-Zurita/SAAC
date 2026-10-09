/**
 * SAAC — Datos Sintéticos de Demostración
 * ===============================================
 * Dataset completo para el Modo Demo / Modo Test.
 * Carga un proyecto ficticio con AMG, métricas, C4 y antipatrones
 * para poder tomar capturas y documentar la funcionalidad del sistema
 * sin necesidad de analizar un proyecto real.
 */
import type {
  ArchitectureModelGraph,
  FitnessEvaluationResult,
  ProjectAnnotations,
  ProjectAnalysisResult,
} from '../../shared/types';

export const DEMO_PROJECT_PATH = 'd:/Elvis/Semestre 2-2026/SAAC-Demo';

export const DEMO_AMG: ArchitectureModelGraph = {
  amgId: 'amg-demo-001',
  analysisRunId: 'run-demo-001',
  projectId: 'saac-demo-system',
  projectName: 'SAAC Architecture Suite',
  detectedStyle: 'layered',
  detectedType: 'desktop',
  styleConfidence: 0.94,
  analyzedAt: new Date().toISOString(),
  parentAmgId: null,
  snapshotType: 'full',

  metrics: {
    totalLoc: 45820,
    totalLloc: 38200,
    totalModules: 5,
    totalClasses: 3,
    totalFunctions: 12,
    totalDependencies: 6,
    avgCyclomaticComplexity: 4.8,
    avgInstability: 0.42,
    avgAbstractness: 0.38,
    avgDistance: 0.20,
    maintainabilityIndexAvg: 78.4,
    cyclicDependencyCount: 1,
    quantumCount: 2,
    fitnessScore: 88.5,
  },

  modules: [
    {
      id: 'src/web-ui',
      name: 'WebUI Gateway (React / Vite)',
      type: 'module',
      language: 'typescript',
      loc: 12400,
      lloc: 10200,
      moduleType: 'ui-component',
      imports: ['react', 'react-dom', 'zustand'],
      importedBy: [],
      classes: [],
      functions: [
        {
          id: 'fn-render-c4',
          name: 'renderC4Canvas',
          visibility: 'public',
          isExported: true,
          parameters: [{ name: 'diagramData', type: 'C4DiagramData', isOptional: false }],
          returnType: 'JSX.Element',
          cyclomaticComplexity: 3,
          cognitiveComplexity: 2,
          loc: 45,
          calls: ['useReactFlow', 'getLayoutedElements'],
        },
      ],
      metrics: {
        ca: 0,
        ce: 4,
        instability: 1.0,
        abstractness: 0.1,
        distance: 0.1,
        lcom4: 1,
        maintainabilityIndex: 84.5,
        cyclomaticComplexityAvg: 3.5,
        cyclomaticComplexityMax: 8,
        moduleCohesion: 0.82,
      },
    },
    {
      id: 'src-tauri/core_engine',
      name: 'Core Engine (Rust)',
      type: 'module',
      language: 'rust',
      loc: 18200,
      lloc: 15100,
      moduleType: 'service',
      imports: ['tauri', 'tokio', 'serde_json'],
      importedBy: ['src/web-ui'],
      classes: [],
      functions: [
        {
          id: 'fn-build-amg',
          name: 'build_architecture_graph',
          visibility: 'public',
          isExported: true,
          parameters: [{ name: 'ast_outcomes', type: '&[AstOutcome]', isOptional: false }],
          returnType: 'ArchitectureModelGraph',
          cyclomaticComplexity: 7,
          cognitiveComplexity: 5,
          loc: 120,
          calls: ['calculate_metrics', 'detect_antipatterns'],
        },
      ],
      metrics: {
        ca: 4,
        ce: 2,
        instability: 0.33,
        abstractness: 0.6,
        distance: 0.07,
        lcom4: 2,
        maintainabilityIndex: 79.2,
        cyclomaticComplexityAvg: 5.2,
        cyclomaticComplexityMax: 14,
        moduleCohesion: 0.71,
      },
    },
    {
      id: 'workers/python_ast',
      name: 'Python AST Worker',
      type: 'module',
      language: 'python',
      loc: 6400,
      lloc: 5200,
      moduleType: 'service',
      imports: ['ast', 'json', 'sys'],
      importedBy: ['src-tauri/core_engine'],
      classes: [
        {
          id: 'cls-py-parser',
          name: 'PythonASTParser',
          isAbstract: false,
          isInterface: false,
          visibility: 'public',
          methods: [],
          attributes: [],
          extends: [],
          implements: [],
          metrics: { wmc: 12, dit: 1, noc: 0, cbo: 3, rfc: 8, mpc: 4, lcom4: 1, tcc: 0.8, lcc: 0.9 },
        },
      ],
      functions: [],
      metrics: {
        ca: 2,
        ce: 1,
        instability: 0.33,
        abstractness: 0.2,
        distance: 0.47,
        lcom4: 1,
        maintainabilityIndex: 82.0,
        cyclomaticComplexityAvg: 4.1,
        cyclomaticComplexityMax: 9,
        moduleCohesion: 0.78,
      },
    },
    {
      id: 'workers/node_ts_ast',
      name: 'TypeScript AST Worker',
      type: 'module',
      language: 'javascript',
      loc: 5200,
      lloc: 4400,
      moduleType: 'service',
      imports: ['typescript', 'fs', 'path'],
      importedBy: ['src-tauri/core_engine'],
      classes: [],
      functions: [],
      metrics: {
        ca: 2,
        ce: 1,
        instability: 0.33,
        abstractness: 0.2,
        distance: 0.47,
        lcom4: 1,
        maintainabilityIndex: 85.1,
        cyclomaticComplexityAvg: 3.9,
        cyclomaticComplexityMax: 8,
        moduleCohesion: 0.80,
      },
    },
    {
      id: 'db/metadata_store',
      name: 'Metadata Persistence (SQLite)',
      type: 'module',
      language: 'rust',
      loc: 3600,
      lloc: 3000,
      moduleType: 'repository',
      imports: ['rusqlite', 'serde'],
      importedBy: ['src-tauri/core_engine'],
      classes: [],
      functions: [],
      metrics: {
        ca: 3,
        ce: 0,
        instability: 0.0,
        abstractness: 0.9,
        distance: 0.1,
        lcom4: 1,
        maintainabilityIndex: 91.0,
        cyclomaticComplexityAvg: 2.0,
        cyclomaticComplexityMax: 4,
        moduleCohesion: 0.95,
      },
    },
  ],

  dependencies: [
    { source: 'src/web-ui', target: 'src-tauri/core_engine', kind: 'http-call', weight: 1 },
    { source: 'src-tauri/core_engine', target: 'workers/python_ast', kind: 'messaging', weight: 1 },
    { source: 'src-tauri/core_engine', target: 'workers/node_ts_ast', kind: 'messaging', weight: 1 },
    { source: 'src-tauri/core_engine', target: 'db/metadata_store', kind: 'import', weight: 1 },
    { source: 'workers/python_ast', target: 'workers/node_ts_ast', kind: 'import', weight: 1 },
    { source: 'workers/node_ts_ast', target: 'workers/python_ast', kind: 'import', weight: 1 },
  ],

  containers: [
    {
      id: 'cont-web',
      name: 'SAAC Frontend Studio',
      type: 'container',
      technology: 'React 18 / Tailwind / Vite',
      containerType: 'spa',
      description: 'Interfaz gráfica reactiva con visor C4 y herramientas de auditoría',
      moduleIds: ['src/web-ui'],
      detectedFrom: 'package.json',
    },
    {
      id: 'cont-engine',
      name: 'Rust Core Orchestrator',
      type: 'container',
      technology: 'Tauri v2 / Rust Tokio',
      containerType: 'api',
      description: 'Motor principal de análisis estático y cálculo de métricas en tiempo real',
      moduleIds: ['src-tauri/core_engine'],
      detectedFrom: 'Cargo.toml',
    },
    {
      id: 'cont-ast-workers',
      name: 'AST Extractors Pool',
      type: 'container',
      technology: 'Python 3.11 / Node.js 20',
      containerType: 'worker',
      description: 'Pool de subprocesses workers aislados para parsing sintáctico',
      moduleIds: ['workers/python_ast', 'workers/node_ts_ast'],
      detectedFrom: 'pyproject.toml',
    },
    {
      id: 'cont-db',
      name: 'Metadata Persistence',
      type: 'container',
      technology: 'SQLite / Embedded Store',
      containerType: 'database',
      description: 'Almacenamiento persistente de ejecuciones, ADRs y modelos AMG',
      moduleIds: ['db/metadata_store'],
      detectedFrom: 'Cargo.toml',
    },
  ],

  externalSystems: [
    {
      id: 'ext-ollama',
      name: 'Ollama Local LLM',
      type: 'external-system',
      description: 'Servicio de inferencia de modelos IA locales (Llama 3 / Mistral)',
      systemType: 'api',
      protocol: 'http',
      detectedVia: 'HTTP GET /api/generate',
    },
    {
      id: 'ext-openrouter',
      name: 'OpenRouter Cloud AI',
      type: 'external-system',
      description: 'API gateway para acceso a Gemini Pro y Claude 3.5 Sonnet',
      systemType: 'api',
      protocol: 'https',
      detectedVia: 'HTTP POST /api/v1/chat/completions',
    },
  ],

  actors: [
    {
      id: 'act-architect',
      name: 'Arquitecto de Software',
      type: 'actor',
      role: 'Auditor de Calidad',
      description: 'Inspecciona acoplamiento, antipatrones y define decisiones ADR',
    },
    {
      id: 'act-developer',
      name: 'Desarrollador Lead',
      type: 'actor',
      role: 'Refactorizador',
      description: 'Consulta sugerencias de IA y ejecuta refactorizaciones de código',
    },
  ],

  externalCalls: [
    {
      moduleId: 'src-tauri/core_engine',
      externalSystemId: 'ext-ollama',
      protocol: 'http',
      description: 'Envía contexto de módulo para análisis de refactorización IA',
    },
  ],

  antipatterns: [
    {
      id: 'ap-cycle-1',
      antipatternType: 'circular-dependency',
      name: 'Dependencia Circular en Workers',
      description: 'Acoplamiento bidireccional detectado entre workers/python_ast y workers/node_ts_ast',
      severity: 'critical',
      affectedModuleIds: ['workers/python_ast', 'workers/node_ts_ast'],
      suggestedBreakPoint: 'Extract shared DTO interfaces into shared/types',
      refactorSuggestion: 'Refactorizar contratos de mensajes a un módulo neutro TypeScript/JSON Schema.',
      cyclePath: ['workers/python_ast', 'workers/node_ts_ast', 'workers/python_ast'],
      ignored: false,
    },
    {
      id: 'ap-god-1',
      antipatternType: 'god-module',
      name: 'God Module Candidate: Core Engine',
      description: 'El módulo src-tauri/core_engine concentra demasiada lógica de orquestación con 18.2k LOC.',
      severity: 'high',
      affectedModuleIds: ['src-tauri/core_engine'],
      refactorSuggestion: 'Dividir en subsistemas independientes: parser_manager, metrics_evaluator y c4_builder.',
      ignored: false,
    },
  ],

  c4Models: {
    contextDiagram: {
      nodes: [
        {
          id: 'sys-saac',
          label: 'SAAC System',
          elementType: 'system',
          technology: 'Tauri + Rust + React',
          description: 'Sistema de Análisis y Auditoría de Código y Arquitectura',
          amgNodeId: 'cont-engine',
        },
        {
          id: 'ext-ollama-c4',
          label: 'Ollama LLM Provider',
          elementType: 'external-system',
          technology: 'REST / HTTP',
          description: 'Modelos de lenguaje locales para refactorización asistida',
        },
        {
          id: 'act-architect-c4',
          label: 'Arquitecto de Software',
          elementType: 'actor',
          technology: '',
          description: 'Revisa métricas, diagramas C4 y antipatrones',
        },
      ],
      edges: [
        { source: 'act-architect-c4', target: 'sys-saac', label: 'Inspecciona código & diagramas' },
        { source: 'sys-saac', target: 'ext-ollama-c4', label: 'Consulta explicaciones de código' },
      ],
    },

    containerDiagram: {
      nodes: [
        {
          id: 'c-web',
          label: 'SAAC Frontend Studio',
          elementType: 'container',
          technology: 'React / Vite',
          description: 'Interfaz de usuario con visor C4 interactivo y paneles de métricas',
        },
        {
          id: 'c-engine',
          label: 'Rust Core Orchestrator',
          elementType: 'container',
          technology: 'Tauri v2 / Rust',
          description: 'Motor de análisis estático AST y evaluación de métricas',
        },
        {
          id: 'c-workers',
          label: 'AST Worker Pool',
          elementType: 'container',
          technology: 'Python / Node.js',
          description: 'Subprocesses de parsing de código por lenguaje',
        },
        {
          id: 'c-db',
          label: 'SQLite Persistence',
          elementType: 'container',
          technology: 'SQLite 3',
          description: 'Almacena histórico de análisis, ADRs y AMGs versionados',
        },
      ],
      edges: [
        { source: 'c-web', target: 'c-engine', label: 'IPC / Tauri Invoke' },
        { source: 'c-engine', target: 'c-workers', label: 'Subprocess Standard I/O' },
        { source: 'c-engine', target: 'c-db', label: 'SQL queries' },
      ],
    },

    componentDiagrams: {
      'cont-engine': {
        nodes: [
          {
            id: 'cmp-parser',
            label: 'AST Parser Manager',
            elementType: 'component',
            technology: 'Rust',
            description: 'Orquesta los workers de parsing por lenguaje y agrega resultados',
          },
          {
            id: 'cmp-metrics',
            label: 'Metrics Evaluator Engine',
            elementType: 'component',
            technology: 'Rust',
            description: 'Calcula Ca, Ce, MI, CC, instabilidad y abstractness',
          },
          {
            id: 'cmp-c4',
            label: 'C4 Model Builder',
            elementType: 'component',
            technology: 'Rust',
            description: 'Construye los diagramas C4 Nivel 1-3 desde el grafo AMG',
          },
          {
            id: 'cmp-ai',
            label: 'AI Bridge Connector',
            elementType: 'component',
            technology: 'Rust reqwest',
            description: 'Gestiona llamadas a Ollama y OpenRouter para refactorización IA',
          },
        ],
        edges: [
          { source: 'cmp-parser', target: 'cmp-metrics', label: 'Pasa AST Parse Trees' },
          { source: 'cmp-metrics', target: 'cmp-c4', label: 'Inyecta Métricas en Grafos' },
          { source: 'cmp-c4', target: 'cmp-ai', label: 'Envía contextos para síntesis' },
        ],
      },
    },
  },
};

export const DEMO_FITNESS_RESULT: FitnessEvaluationResult = {
  fitnessScore: 88.5,
  totalRules: 3,
  passedRules: 2,
  failedRules: 1,
  evaluations: [
    {
      ruleId: 'rule-no-cyclic-deps',
      ruleName: 'Ausencia de Dependencias Circulares',
      severity: 'critical',
      passed: false,
      score: 60,
      weight: 0.30,
      message: 'Detectado 1 ciclo entre workers/python_ast y workers/node_ts_ast',
    },
    {
      ruleId: 'rule-mi-threshold',
      ruleName: 'Mantenibilidad de Código (MI >= 65)',
      severity: 'high',
      passed: true,
      score: 95,
      weight: 0.35,
      message: 'MI promedio del proyecto: 78.4 / 100 ✓',
    },
    {
      ruleId: 'rule-layer-isolation',
      ruleName: 'Aislamiento de Capa Frontend/Backend',
      severity: 'medium',
      passed: true,
      score: 100,
      weight: 0.35,
      message: 'Acceso regulado vía invocaciones IPC Tauri ✓',
    },
  ],
};

export const DEMO_ANNOTATIONS: ProjectAnnotations = {
  adrs: [
    {
      id: 'adr-001',
      number: 1,
      title: 'Adopción de GraphForge UI Token-Based Design System',
      status: 'Accepted',
      date: '2026-08-10',
      author: 'Jherson Zurita',
      context:
        'El sistema requería un sistema de tematización robusto capaz de alternar entre Light y Dark Mode sin reinstanciar diagramas ni causar repintados en ReactFlow.',
      decision:
        'Se implementaron CSS Custom Properties (--bg, --panel, --border, --purple) inyectadas en la raíz del documento, garantizando respuesta instantánea en menos de 16ms.',
      consequences:
        'Intercambio de tema claro/oscuro fluido, compatibilidad con capturas estáticas para documentación e integración transparente.',
    },
    {
      id: 'adr-002',
      number: 2,
      title: 'Uso de Workers Aislados para Parsing AST Multilenguaje',
      status: 'Accepted',
      date: '2026-08-12',
      author: 'Elvis — Tesis SAAC',
      context:
        'Parsear Python 3.11 y TypeScript requiere bibliotecas nativas de sus respectivos ecosistemas que no pueden coexistir en el mismo proceso.',
      decision:
        'Delegar el parsing a subprocesses aislados comunicados vía JSON-Lines streaming con el motor de Rust.',
      consequences: 'Aislamiento total de fallos de sintaxis sin bloquear el hilo principal de Tauri.',
    },
  ],

  risks: [
    {
      id: 'risk-001',
      title: 'Volumen de Memoria en Grafos con >10,000 Nodos',
      severity: 'Medium',
      description: 'Renderizar miles de nodos simultáneos en canvas HTML puede reducir los FPS de desplazamiento.',
      mitigation: 'Implementar aglutinamiento de contenedores C4 y virtualización con Dagre.',
      affectedModuleIds: ['src/web-ui'],
    },
  ],

  ignoredAntipatterns: [],

  annotations: [
    {
      id: 'ann-001',
      targetId: 'src-tauri/core_engine',
      targetType: 'module',
      title: 'Optimización de Threads',
      content: 'Revisar la configuración de rayon thread pool para análisis paralelos masivos.',
      createdAt: '2026-08-15',
      author: 'Jherson Zurita',
    },
  ],
};

export const DEMO_ANALYSIS_RESULT: ProjectAnalysisResult = {
  totalFiles: 142,
  successful: 142,
  failed: 0,
  skipped: 0,
  skippedFiles: [],
  durationMs: 1420,
  cancelled: false,
  outcomes: [],
};
