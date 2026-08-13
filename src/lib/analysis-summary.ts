import type {
  ArchitectureModelGraph,
  FitnessEvaluationResult,
  ProjectAnalysisResult,
} from '../../shared/types';

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
  failedFilesDetails: Array<{
    filePath: string;
    status: string;
    errorMessage?: string;
  }>;
  skippedFilesDetails: Array<{
    filePath: string;
    reason: string;
  }>;
  diagramsDiagnostics: Array<{
    diagramName: string;
    hasData: boolean;
    nodeCount: number;
    edgeCount: number;
    statusNote: string;
  }>;
  antipatternsList: Array<{
    id: string;
    type: string;
    name: string;
    severity: string;
    affectedModules: string[];
    ignored: boolean;
  }>;
}

export function generateAnalysisSummary(
  projectPath: string,
  result: ProjectAnalysisResult,
  fitnessResult?: FitnessEvaluationResult | null
): AnalysisSummaryDiagnostics {
  const amg: ArchitectureModelGraph | undefined = result.amg || undefined;

  // Desglose por lenguaje
  const langMap: Record<string, { files: number; loc: number }> = {};
  if (amg) {
    for (const mod of amg.modules) {
      const lang = mod.language || 'unknown';
      if (!langMap[lang]) langMap[lang] = { files: 0, loc: 0 };
      langMap[lang].files += 1;
      langMap[lang].loc += mod.loc || 0;
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

  // Lista de diagramas y diagnóstico de datos
  const diagramsDiagnostics: Array<{
    diagramName: string;
    hasData: boolean;
    nodeCount: number;
    edgeCount: number;
    statusNote: string;
  }> = [];

  if (amg?.c4Models) {
    const c4 = amg.c4Models;
    diagramsDiagnostics.push({
      diagramName: 'C4 Nivel 1 (Contexto)',
      hasData: (c4.contextDiagram?.nodes?.length || 0) > 0,
      nodeCount: c4.contextDiagram?.nodes?.length || 0,
      edgeCount: c4.contextDiagram?.edges?.length || 0,
      statusNote: (c4.contextDiagram?.nodes?.length || 0) > 0 ? 'OK' : 'Sin nodos de sistema/actores',
    });

    diagramsDiagnostics.push({
      diagramName: 'C4 Nivel 2 (Contenedores)',
      hasData: (c4.containerDiagram?.nodes?.length || 0) > 0,
      nodeCount: c4.containerDiagram?.nodes?.length || 0,
      edgeCount: c4.containerDiagram?.edges?.length || 0,
      statusNote: (c4.containerDiagram?.nodes?.length || 0) > 0 ? 'OK' : 'Sin contenedores detectados',
    });

    for (const [key, diag] of Object.entries(c4.componentDiagrams || {})) {
      diagramsDiagnostics.push({
        diagramName: key,
        hasData: (diag?.nodes?.length || 0) > 0,
        nodeCount: diag?.nodes?.length || 0,
        edgeCount: diag?.edges?.length || 0,
        statusNote: (diag?.nodes?.length || 0) > 0 ? 'OK' : 'Vista sin datos generados',
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
    failedFilesDetails,
    skippedFilesDetails: (result.skippedFiles || []).map((sf) => ({
      filePath: sf.filePath,
      reason: sf.reason,
    })),
    diagramsDiagnostics,
    antipatternsList,
  };

  // Guardar en localStorage para fácil inspección / depuración en consola del navegador
  try {
    localStorage.setItem('saac_last_analysis_summary', JSON.stringify(summary, null, 2));
    console.log('✅ [SAAC Debug Summary] Resumen de análisis generado con éxito:', summary);
  } catch (err) {
    console.warn('Error al guardar resumen en localStorage:', err);
  }

  return summary;
}
