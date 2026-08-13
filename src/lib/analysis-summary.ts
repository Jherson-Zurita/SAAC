import type {
  ArchitectureModelGraph,
  FitnessEvaluationResult,
  ProjectAnalysisResult,
} from '../../shared/types';

export interface DiagramDiagnosticItem {
  diagramName: string;
  hasData: boolean;
  nodeCount: number;
  edgeCount: number;
  statusNote: string;
  diagnosticExplanation: string;
}

export interface AnalysisSummaryDiagnostics {
  timestamp: string;
  projectPath: string;
  projectName: string;
  saacVersion: string;
  overview: {
    totalFilesScanned: number;
    successfulFiles: number;
    failedFiles: number;
    skippedFiles: number;
    durationMs: number;
    cancelled: boolean;
  };
  languageBreakdown: Record<string, { files: number; loc: number }>;
  architecture: {
    detectedType: string;
    detectedStyle: string;
    styleConfidence: number;
    moduleCount: number;
    dependencyCount: number;
    containerCount: number;
    externalSystemCount: number;
    actorCount: number;
    antipatternCount: number;
    fitnessScore?: number;
  };
  astDetails: {
    totalClassesExtracted: number;
    totalFunctionsExtracted: number;
    totalFunctionsWithCalls: number;
    totalExternalCalls: number;
  };
  failedFilesDetails: Array<{
    filePath: string;
    status: string;
    errorMessage?: string;
  }>;
  skippedFilesDetails: Array<{
    filePath: string;
    reason: string;
  }>;
  diagramsDiagnostics: DiagramDiagnosticItem[];
  antipatternsList: Array<{
    id: string;
    type: string;
    name: string;
    severity: string;
    affectedModules: string[];
    ignored: boolean;
  }>;
  problematicModulesSummary: Array<{
    id: string;
    name: string;
    loc: number;
    maintainabilityIndex: number;
    cyclomaticComplexityMax: number;
    couplingTotal: number;
  }>;
}

function getDiagramExplanation(key: string, nodeCount: number, edgeCount: number): string {
  const isZeroNodes = nodeCount === 0;
  const isZeroEdges = edgeCount === 0;

  if (key === 'supplementary:circular-dependencies') {
    return isZeroNodes && isZeroEdges
      ? 'OK (Limpio): 0 dependencias circulares detectadas. El proyecto no contiene ciclos A ➔ B ➔ A.'
      : 'Atención: Se detectaron ciclos de dependencia directa entre los módulos señalados.';
  }

  if (key === 'supplementary:er-diagram') {
    return isZeroNodes
      ? 'Info: No se encontraron clases o modelos ORM explícitos (TypeORM, Prisma, JPA, Django, SQLAlchemy).'
      : 'OK: Entidades y relaciones de base de datos extraídas correctamente.';
  }

  if (key === 'supplementary:sequence-diagram') {
    return isZeroNodes
      ? 'Info: No se identificaron trazas explícitas de flujo de secuencia temporal inter-componente.'
      : 'OK: Secuencia de llamadas extraída correctamente.';
  }

  if (key === 'supplementary:treemap') {
    return 'OK (Por Diseño): El Treemap es una representación jerárquica por bloques de LOC. No requiere aristas de conexión por definición.';
  }

  if (key === 'supplementary:ownership-map') {
    return 'OK (Por Diseño): Mapa de atribución de autoría y contribución Git por archivo. No requiere aristas de conexión por definición.';
  }

  if (key === 'supplementary:call-graph') {
    return isZeroEdges
      ? `Advertencia: Se catalogaron ${nodeCount} funciones/métodos, pero no se resolvieron invocaciones estáticas directas punto a punto (patrón común en JS/TS dinámico con callbacks o middlewares anónimos).`
      : `OK: Grafo de llamadas generado con ${edgeCount} invocaciones inter-función resolutivas.`;
  }

  if (key === 'supplementary:dynamic-diagram') {
    return isZeroEdges
      ? `Visualización estática de ${nodeCount} nodos dinámicos sin aristas de ejecución registradas.`
      : `OK: Flujos dinámicos registrados con ${edgeCount} interacciones.`;
  }

  if (key === 'supplementary:dfd-diagram') {
    return isZeroEdges
      ? `Se identificaron ${nodeCount} procesos pero sin flujo de datos directo conectado.`
      : `OK: Diagrama de flujo de datos con ${edgeCount} transformaciones.`;
  }

  if (nodeCount > 0 && edgeCount > 0) {
    return `OK: Vista generada correctamente con ${nodeCount} nodos y ${edgeCount} aristas.`;
  }

  if (nodeCount > 0 && edgeCount === 0) {
    return `Vista con ${nodeCount} nodos presentados pero sin aristas de acoplamiento.`;
  }

  return 'Vista sin elementos generados por el analizador.';
}

export function generateAnalysisSummary(
  projectPath: string,
  result: ProjectAnalysisResult,
  fitnessResult?: FitnessEvaluationResult | null
): AnalysisSummaryDiagnostics {
  const amg: ArchitectureModelGraph | undefined = result.amg || undefined;

  // Desglose por lenguaje
  const langMap: Record<string, { files: number; loc: number }> = {};
  let totalClasses = 0;
  let totalFunctions = 0;
  let totalFunctionsWithCalls = 0;

  if (amg) {
    for (const mod of amg.modules) {
      const lang = mod.language || 'unknown';
      if (!langMap[lang]) langMap[lang] = { files: 0, loc: 0 };
      langMap[lang].files += 1;
      langMap[lang].loc += mod.loc || 0;

      totalClasses += mod.classes?.length || 0;
      totalFunctions += mod.functions?.length || 0;
      if (mod.functions) {
        totalFunctionsWithCalls += mod.functions.filter(
          (f) => f.calls && f.calls.length > 0
        ).length;
      }
    }
  }

  // Lista de archivos fallidos
  const failedFilesDetails = (result.outcomes || [])
    .filter((o) => o.status !== 'success')
    .map((o) => ({
      filePath: o.filePath,
      status: o.status,
      errorMessage: o.errorMessage,
    }));

  // Diagnóstico detallado por diagrama
  const diagramsDiagnostics: DiagramDiagnosticItem[] = [];

  if (amg?.c4Models) {
    const c4 = amg.c4Models;

    const ctxNodes = c4.contextDiagram?.nodes?.length || 0;
    const ctxEdges = c4.contextDiagram?.edges?.length || 0;
    diagramsDiagnostics.push({
      diagramName: 'C4 Nivel 1 (Contexto)',
      hasData: ctxNodes > 0,
      nodeCount: ctxNodes,
      edgeCount: ctxEdges,
      statusNote: ctxNodes > 0 ? 'OK' : 'Sin nodos de sistema/actores',
      diagnosticExplanation: getDiagramExplanation('c4-context', ctxNodes, ctxEdges),
    });

    const cntNodes = c4.containerDiagram?.nodes?.length || 0;
    const cntEdges = c4.containerDiagram?.edges?.length || 0;
    diagramsDiagnostics.push({
      diagramName: 'C4 Nivel 2 (Contenedores)',
      hasData: cntNodes > 0,
      nodeCount: cntNodes,
      edgeCount: cntEdges,
      statusNote: cntNodes > 0 ? 'OK' : 'Sin contenedores detectados',
      diagnosticExplanation: getDiagramExplanation('c4-container', cntNodes, cntEdges),
    });

    for (const [key, diag] of Object.entries(c4.componentDiagrams || {})) {
      const nLen = diag?.nodes?.length || 0;
      const eLen = diag?.edges?.length || 0;
      diagramsDiagnostics.push({
        diagramName: key,
        hasData: nLen > 0,
        nodeCount: nLen,
        edgeCount: eLen,
        statusNote: nLen > 0 ? 'OK' : 'Vista sin datos generados',
        diagnosticExplanation: getDiagramExplanation(key, nLen, eLen),
      });
    }
  }

  // Antipatrones
  const antipatternsList = (amg?.antipatterns || []).map((ap) => ({
    id: ap.id,
    type: ap.antipatternType,
    name: ap.name,
    severity: ap.severity,
    affectedModules: ap.affectedModuleIds || [],
    ignored: ap.ignored,
  }));

  // Módulos problemáticos (baja mantenibilidad o alta complejidad)
  const problematicModulesSummary = (amg?.modules || [])
    .filter(
      (m) =>
        m.metrics.maintainabilityIndex < 65 ||
        m.metrics.cyclomaticComplexityMax > 12 ||
        m.metrics.ca + m.metrics.ce > 8
    )
    .sort((a, b) => a.metrics.maintainabilityIndex - b.metrics.maintainabilityIndex)
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      name: m.name,
      loc: m.loc,
      maintainabilityIndex: Number(m.metrics.maintainabilityIndex.toFixed(1)),
      cyclomaticComplexityMax: m.metrics.cyclomaticComplexityMax,
      couplingTotal: m.metrics.ca + m.metrics.ce,
    }));

  const summary: AnalysisSummaryDiagnostics = {
    timestamp: new Date().toISOString(),
    projectPath,
    projectName: amg?.projectName || projectPath.split(/[/\\]/).pop() || 'Proyecto',
    saacVersion: '2.0.0',
    overview: {
      totalFilesScanned: result.totalFiles,
      successfulFiles: result.successful,
      failedFiles: result.failed,
      skippedFiles: result.skipped,
      durationMs: result.durationMs,
      cancelled: result.cancelled,
    },
    languageBreakdown: langMap,
    architecture: {
      detectedType: amg?.detectedType || 'unknown',
      detectedStyle: amg?.detectedStyle || 'unknown',
      styleConfidence: amg?.styleConfidence || 0,
      moduleCount: amg?.modules.length || 0,
      dependencyCount: amg?.dependencies.length || 0,
      containerCount: amg?.containers.length || 0,
      externalSystemCount: amg?.externalSystems.length || 0,
      actorCount: amg?.actors.length || 0,
      antipatternCount: amg?.antipatterns.length || 0,
      fitnessScore: fitnessResult?.fitnessScore ?? amg?.metrics.fitnessScore,
    },
    astDetails: {
      totalClassesExtracted: totalClasses,
      totalFunctionsExtracted: totalFunctions,
      totalFunctionsWithCalls: totalFunctionsWithCalls,
      totalExternalCalls: amg?.externalCalls?.length || 0,
    },
    failedFilesDetails,
    skippedFilesDetails: (result.skippedFiles || []).map((sf) => ({
      filePath: sf.filePath,
      reason: sf.reason,
    })),
    diagramsDiagnostics,
    antipatternsList,
    problematicModulesSummary,
  };

  // Guardar en localStorage para fácil inspección / depuración en consola del navegador
  try {
    localStorage.setItem('saac_last_analysis_summary', JSON.stringify(summary, null, 2));
    console.log('✅ [SAAC Debug Summary] Resumen detallado de análisis generado:', summary);
  } catch (err) {
    console.warn('Error al guardar resumen en localStorage:', err);
  }

  return summary;
}
