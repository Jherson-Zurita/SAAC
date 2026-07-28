/**
 * tauri-api.ts — Wrapper único e inmutable para todas las llamadas IPC (`invoke`, `listen`) de SAAC v2.0.
 * Ningún componente o store llama directamente a `@tauri-apps/api/core` o `event`.
 */

import { invoke } from '@tauri-apps/api/core';
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
} from '../../shared/types';

// ── Análises y Proyecto ──

export async function analyzeProject(path: string): Promise<ProjectAnalysisResult> {
  return await invoke<ProjectAnalysisResult>('analyze_project', { path });
}

export async function cancelAnalysis(): Promise<void> {
  await invoke('cancel_analysis');
}

export async function openProject(path: string): Promise<string> {
  return await invoke<string>('open_project', { path });
}

export function onProjectProgress(callback: (event: ProjectProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProjectProgressEvent>('project://progress', (e) => callback(e.payload));
}

// ── IA Local ──

export async function askAi(
  prompt: string,
  contextType?: string,
  targetId?: string,
  amg?: ArchitectureModelGraph
): Promise<{ answer: string; tokensUsed?: number }> {
  return await invoke<{ answer: string; tokensUsed?: number }>('ask_ai', {
    prompt,
    contextType,
    targetId,
    amg,
  });
}

export async function checkAiStatus(): Promise<AiStatusResult> {
  return await invoke<AiStatusResult>('check_ai_status');
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
