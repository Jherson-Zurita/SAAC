import { create } from 'zustand';
import type {
  ArchitectureModelGraph,
  ProjectAnalysisResult,
  ProjectProgressEvent,
  ProjectConfig,
  ProjectAnnotations,
  FitnessEvaluationResult,
} from '../../shared/types';

interface ProjectState {
  projectPath: string | null;
  projectName: string | null;
  amg: ArchitectureModelGraph | null;
  isAnalyzing: boolean;
  progress: ProjectProgressEvent | null;
  lastAnalysisResult: ProjectAnalysisResult | null;
  projectConfig: ProjectConfig | null;
  annotations: ProjectAnnotations | null;
  fitnessResult: FitnessEvaluationResult | null;

  setProjectPath: (path: string | null, name?: string) => void;
  setAmg: (amg: ArchitectureModelGraph | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setProgress: (progress: ProjectProgressEvent | null) => void;
  setLastAnalysisResult: (result: ProjectAnalysisResult | null) => void;
  setProjectConfig: (config: ProjectConfig | null) => void;
  setAnnotations: (annotations: ProjectAnnotations | null) => void;
  setFitnessResult: (result: FitnessEvaluationResult | null) => void;
  resetProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectPath: null,
  projectName: null,
  amg: null,
  isAnalyzing: false,
  progress: null,
  lastAnalysisResult: null,
  projectConfig: null,
  annotations: null,
  fitnessResult: null,

  setProjectPath: (path, name) =>
    set({
      projectPath: path,
      projectName: name || (path ? path.split(/[/\\]/).pop() || 'Proyecto' : null),
    }),
  setAmg: (amg) => set({ amg }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setProgress: (progress) => set({ progress }),
  setLastAnalysisResult: (lastAnalysisResult) => set({ lastAnalysisResult }),
  setProjectConfig: (projectConfig) => set({ projectConfig }),
  setAnnotations: (annotations) => set({ annotations }),
  setFitnessResult: (fitnessResult) => set({ fitnessResult }),
  resetProject: () =>
    set({
      projectPath: null,
      projectName: null,
      amg: null,
      isAnalyzing: false,
      progress: null,
      lastAnalysisResult: null,
      projectConfig: null,
      annotations: null,
      fitnessResult: null,
    }),
}));
