/**
 * tauri-api.ts — Wrapper único e inmutable para todas las llamadas IPC (`invoke`, `listen`) de SAAC.
 * Ningún componente o store llama directamente a `@tauri-apps/api/core` o `event`.
 */

import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type {
  ArchitectureModelGraph,
  ProjectAnalysisResult,
  ProjectProgressEvent,
  ProjectConfig,
  ConsoleCommandOutput,
  ProjectAnnotations,
  Annotation,
  Adr,
  Risk,
  RuleConfig,
  FitnessEvaluationResult,
  AnalysisHistory,
  AMGDelta,
  GlobalConfig,
  C4DiagramData,
  AiStatusResult,
  AiConfig,
  AiResponse,
  AiStreamSummary,
  ProposedArchitecture,
  ProposedArchitectureSummary,
  ProposedNode,
  ProposedNodeType,
  NodePosition,
  ComparisonReport,
  ExportFormat,
  WorkersStatus,
  ModuleSource,
} from '../../shared/types';

// ── Análises y Proyecto ──

export async function analyzeProject(path: string): Promise<ProjectAnalysisResult> {
  return await invoke<ProjectAnalysisResult>('analyze_project', { path });
}

export async function cancelAnalysis(): Promise<void> {
  await invoke('cancel_analysis');
}

export async function getWorkersStatus(): Promise<WorkersStatus> {
  return await invoke<WorkersStatus>('get_workers_status');
}

export async function openProject(path: string): Promise<string> {
  return await invoke<string>('open_project', { path });
}

/**
 * Guarda un informe ya generado. La ruta la elige el usuario en el diálogo nativo
 * que abre el backend; devuelve `null` si canceló.
 */
export async function saveReport(
  format: 'markdown' | 'pdf',
  fileStem: string,
  contents: Uint8Array
): Promise<string | null> {
  return await invoke<string | null>('save_report', { format, fileStem, contents: Array.from(contents) });
}

export async function readModuleSource(projectPath: string, moduleId: string): Promise<ModuleSource> {
  return await invoke<ModuleSource>('read_module_source', { projectPath, moduleId });
}

export function onProjectProgress(callback: (event: ProjectProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProjectProgressEvent>('project://progress', (e) => callback(e.payload));
}

// ── IA Local & Cloud (Ollama / Gemini / OpenAI) ──

const AI_CONFIG_STORAGE_KEY = 'saac_ai_config';

/** Configuración de IA no secreta. La API key vive en el almacén seguro del sistema (backend). */
export function getSavedAiConfig(): AiConfig | undefined {
  const saved = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!saved) return undefined;
  try {
    const { apiKey: _apiKey, ...config } = JSON.parse(saved) as AiConfig;
    return config;
  } catch {
    return undefined;
  }
}

export function saveAiConfig(config: AiConfig): void {
  const { apiKey: _apiKey, ...publicConfig } = config;
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(publicConfig));
}

let legacyKeyMigration: Promise<void> | null = null;

/** Mueve una API key guardada por versiones anteriores en `localStorage` al almacén seguro. */
function migrateLegacyAiApiKey(): Promise<void> {
  legacyKeyMigration ??= (async () => {
    const saved = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as AiConfig;
      if (!parsed.apiKey) return;
      await invoke<boolean>('set_ai_api_key', { apiKey: parsed.apiKey });
      saveAiConfig(parsed);
    } catch (err) {
      console.warn('No se pudo migrar la API key al almacén seguro:', err);
      legacyKeyMigration = null;
    }
  })();
  return legacyKeyMigration;
}

/** Guarda la API key en el almacén seguro; `null` o vacía la elimina. Devuelve si queda una guardada. */
export async function saveAiApiKey(apiKey: string | null): Promise<boolean> {
  return await invoke<boolean>('set_ai_api_key', { apiKey: apiKey?.trim() || null });
}

export async function hasAiApiKey(): Promise<boolean> {
  await migrateLegacyAiApiKey();
  return await invoke<boolean>('has_ai_api_key');
}

export async function askAi(
  prompt: string,
  contextType?: string,
  targetId?: string,
  amg?: ArchitectureModelGraph
): Promise<{
  answer: string;
  tokensUsed?: number;
  isMockFallback: boolean;
  providerUsed: AiResponse['providerUsed'];
  modelUsed: string;
}> {
  await migrateLegacyAiApiKey();
  const config = getSavedAiConfig();
  const res = await invoke<AiResponse>('ask_ai', {
    prompt,
    contextType,
    targetId,
    config,
    amg,
  });
  return {
    answer: res.content,
    tokensUsed: res.completionTokens,
    isMockFallback: res.isMockFallback,
    providerUsed: res.providerUsed,
    modelUsed: res.modelUsed,
  };
}

type AiStreamEvent =
  | { event: 'delta'; data: { content: string } }
  | { event: 'done'; data: AiStreamSummary };

/**
 * Consulta a la IA recibiendo el texto a medida que se genera (`onDelta`).
 * Se resuelve con el evento `done` del canal, que siempre llega después del último fragmento.
 */
export async function askAiStream(
  requestId: string,
  prompt: string,
  contextType: string | undefined,
  targetId: string | undefined,
  amg: ArchitectureModelGraph | undefined,
  onDelta: (text: string) => void
): Promise<AiStreamSummary> {
  await migrateLegacyAiApiKey();
  const config = getSavedAiConfig();

  return await new Promise<AiStreamSummary>((resolve, reject) => {
    let settled = false;
    const finish = (summary: AiStreamSummary) => {
      if (settled) return;
      settled = true;
      resolve(summary);
    };

    const channel = new Channel<AiStreamEvent>();
    channel.onmessage = (message) => {
      if (message.event === 'delta') onDelta(message.data.content);
      else finish(message.data);
    };

    invoke<AiStreamSummary>('ask_ai_stream', {
      requestId,
      prompt,
      contextType,
      targetId,
      config,
      amg,
      onEvent: channel,
    })
      // Respaldo por si el evento `done` no llegara.
      .then((summary) => setTimeout(() => finish(summary), 2000))
      .catch((err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
  });
}

export async function cancelAiStream(requestId: string): Promise<boolean> {
  return await invoke<boolean>('cancel_ai_stream', { requestId });
}

/** `customConfig.apiKey` solo se envía para probar una key escrita y aún no guardada. */
export async function checkAiStatus(customConfig?: AiConfig): Promise<AiStatusResult> {
  await migrateLegacyAiApiKey();
  const config = customConfig || getSavedAiConfig();
  return await invoke<AiStatusResult>('check_ai_status', { config });
}

// ── Módulo 1: Project Config & Ignorados ──

export async function getProjectConfig(projectPath: string): Promise<ProjectConfig> {
  return await invoke<ProjectConfig>('get_project_config', { projectPath });
}

export async function updateProjectConfig(projectPath: string, config: ProjectConfig): Promise<ProjectConfig> {
  return await invoke<ProjectConfig>('update_project_config', { projectPath, config });
}

// ── Módulo 2: Consola SAAC ──

export async function executeConsoleCommand(
  input: string,
  projectPath?: string
): Promise<ConsoleCommandOutput> {
  return await invoke<ConsoleCommandOutput>('execute_console_command', { input, projectPath });
}

// ── Módulo 3: Anotaciones, ADRs, Riesgos e Ignorados ──

export async function loadProjectAnnotations(projectPath: string): Promise<ProjectAnnotations> {
  return await invoke<ProjectAnnotations>('load_project_annotations', { projectPath });
}

export async function addAnnotation(projectPath: string, annotation: Annotation): Promise<ProjectAnnotations> {
  return await invoke<ProjectAnnotations>('add_annotation', { projectPath, annotation });
}

export async function addAdr(projectPath: string, adr: Adr): Promise<ProjectAnnotations> {
  return await invoke<ProjectAnnotations>('add_adr', { projectPath, adr });
}

export async function ignoreAntipattern(
  projectPath: string,
  antipatternId: string,
  justification: string,
  author: string = 'User'
): Promise<ProjectAnnotations> {
  return await invoke<ProjectAnnotations>('ignore_antipattern', {
    projectPath,
    antipatternId,
    justification,
    author,
  });
}

export async function addRisk(projectPath: string, risk: Risk): Promise<ProjectAnnotations> {
  return await invoke<ProjectAnnotations>('add_risk', { projectPath, risk });
}

// ── Módulo 4: Motor de Reglas & Fitness Score ──

export async function getRulesConfig(projectPath: string): Promise<RuleConfig> {
  return await invoke<RuleConfig>('get_rules_config', { projectPath });
}

export async function updateRulesConfig(projectPath: string, config: RuleConfig): Promise<RuleConfig> {
  return await invoke<RuleConfig>('update_rules_config', { projectPath, config });
}

export async function evaluateFitnessRules(
  projectPath: string,
  amg?: ArchitectureModelGraph
): Promise<FitnessEvaluationResult> {
  return await invoke<FitnessEvaluationResult>('evaluate_fitness_rules', { projectPath, amg });
}

// ── Módulo 5: Historial y Deltas ──

export async function getAnalysisHistory(projectPath: string): Promise<AnalysisHistory> {
  return await invoke<AnalysisHistory>('get_analysis_history', { projectPath });
}

export async function compareAnalysisRuns(
  projectPath: string,
  runIdA: string,
  runIdB: string
): Promise<AMGDelta> {
  return await invoke<AMGDelta>('compare_analysis_runs', { projectPath, runIdA, runIdB });
}

// ── Módulo 6: Configuración Global ──

export async function getGlobalConfig(): Promise<GlobalConfig> {
  return await invoke<GlobalConfig>('get_global_config');
}

export async function updateGlobalConfig(config: GlobalConfig): Promise<GlobalConfig> {
  return await invoke<GlobalConfig>('update_global_config', { config });
}

// ── Drill-down Nivel 4 (UML de Código) ──

export async function getModuleCodeDiagram(
  moduleId: string,
  amg: ArchitectureModelGraph
): Promise<C4DiagramData> {
  return await invoke<C4DiagramData>('get_module_code_diagram', { moduleId, amg });
}

// ── Módulo de Diseño Arquitectónico ──

export async function createProposedArchitecture(
  projectPath: string,
  name: string,
  basedOnAnalysisRunId: string | null = null,
  description: string | null = null
): Promise<ProposedArchitecture> {
  return await invoke<ProposedArchitecture>('create_proposed_architecture', {
    projectPath,
    name,
    basedOnRunId: basedOnAnalysisRunId,
    description,
  });
}

export async function listProposedArchitectures(
  projectPath: string
): Promise<ProposedArchitectureSummary[]> {
  return await invoke<ProposedArchitectureSummary[]>('list_proposed_architectures', {
    projectPath,
  });
}

export async function getProposedArchitecture(
  projectPath: string,
  designId: string
): Promise<ProposedArchitecture> {
  return await invoke<ProposedArchitecture>('get_proposed_architecture', {
    projectPath,
    designId,
  });
}

export async function updateProposedArchitecture(
  projectPath: string,
  designId: string,
  architecture: ProposedArchitecture
): Promise<ProposedArchitecture> {
  return await invoke<ProposedArchitecture>('update_proposed_architecture', {
    projectPath,
    designId,
    architecture,
  });
}

export async function addProposedNode(
  projectPath: string,
  designId: string,
  nodeType: ProposedNodeType,
  label: string,
  position: NodePosition
): Promise<ProposedNode> {
  return await invoke<ProposedNode>('add_proposed_node', {
    projectPath,
    designId,
    nodeType,
    label,
    position,
  });
}

export async function deleteProposedArchitecture(
  projectPath: string,
  designId: string
): Promise<void> {
  await invoke('delete_proposed_architecture', { projectPath, designId });
}

export async function compareProposedArchitecture(
  projectPath: string,
  designId: string,
  againstRunId: string
): Promise<ComparisonReport> {
  return await invoke<ComparisonReport>('compare_proposed_architecture', {
    projectPath,
    designId,
    againstRunId,
  });
}

export async function exportProposedArchitecture(
  projectPath: string,
  designId: string,
  format: ExportFormat
): Promise<string> {
  return await invoke<string>('export_proposed_architecture', {
    projectPath,
    designId,
    format,
  });
}

export async function saveProposedArchitectureExport(
  projectPath: string,
  designId: string,
  format: ExportFormat,
  targetPath: string
): Promise<void> {
  await invoke('save_proposed_architecture_export', {
    projectPath,
    designId,
    format,
    targetPath,
  });
}
