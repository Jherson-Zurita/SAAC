import { create } from 'zustand';
import type { C4DiagramData } from '../../shared/types';

export type C4Level = 1 | 2 | 3 | 4;

export interface BreadcrumbItem {
  level: C4Level;
  label: string;
  containerId?: string;
  moduleId?: string;
}

interface DiagramState {
  c4Level: C4Level;
  activeContainerId: string | null;
  activeModuleId: string | null;
  codeDiagramData: C4DiagramData | null;
  breadcrumbs: BreadcrumbItem[];
  zoom: number;
  isLoadingCodeDiagram: boolean;
  codeDiagramError: string | null;

  setC4Level: (level: C4Level, containerId?: string | null, moduleId?: string | null, label?: string) => void;
  setCodeDiagramData: (data: C4DiagramData | null) => void;
  setCodeDiagramLoading: (loading: boolean) => void;
  setCodeDiagramError: (error: string | null) => void;
  navigateToBreadcrumb: (index: number) => void;
  setZoom: (zoom: number) => void;
  resetDiagram: () => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  c4Level: 1,
  activeContainerId: null,
  activeModuleId: null,
  codeDiagramData: null,
  breadcrumbs: [{ level: 1, label: 'Contexto' }],
  zoom: 1,
  isLoadingCodeDiagram: false,
  codeDiagramError: null,

  setC4Level: (level, containerId = null, moduleId = null, label) =>
    set((state) => {
      const context: BreadcrumbItem = { level: 1, label: 'Contexto' };
      const containers: BreadcrumbItem = { level: 2, label: 'Contenedores' };
      const components: BreadcrumbItem = {
        level: 3,
        label: level === 3 && label ? label : `Componentes${containerId ? `: ${containerId}` : ''}`,
        containerId: containerId || undefined,
      };
      const code: BreadcrumbItem = {
        level: 4,
        label: label || `Código${moduleId ? `: ${moduleId}` : ''}`,
        containerId: containerId || state.activeContainerId || undefined,
        moduleId: moduleId || undefined,
      };

      let breadcrumbs: BreadcrumbItem[];
      if (level === 1) {
        breadcrumbs = [context];
      } else if (level === 2) {
        breadcrumbs = [context, { ...containers, label: label || containers.label }];
      } else if (level === 3) {
        breadcrumbs = [context, containers, components];
      } else {
        const existingComponents = state.breadcrumbs.find((item) => item.level === 3) || components;
        breadcrumbs = [context, containers, existingComponents, code];
      }

      return {
        c4Level: level,
        activeContainerId: level <= 2 ? null : containerId ?? state.activeContainerId,
        activeModuleId: level === 4 ? moduleId : null,
        breadcrumbs,
        codeDiagramError: null,
      };
    }),

  setCodeDiagramData: (codeDiagramData) => set({ codeDiagramData }),
  setCodeDiagramLoading: (isLoadingCodeDiagram) => set({ isLoadingCodeDiagram }),
  setCodeDiagramError: (codeDiagramError) => set({ codeDiagramError }),

  navigateToBreadcrumb: (index) =>
    set((state) => {
      const target = state.breadcrumbs[index];
      if (!target) return state;
      return {
        c4Level: target.level,
        activeContainerId: target.containerId || (target.level >= 3 ? state.activeContainerId : null),
        activeModuleId: target.moduleId || null,
        breadcrumbs: state.breadcrumbs.slice(0, index + 1),
        codeDiagramError: null,
      };
    }),

  setZoom: (zoom) => set({ zoom }),

  resetDiagram: () =>
    set({
      c4Level: 1,
      activeContainerId: null,
      activeModuleId: null,
      codeDiagramData: null,
      breadcrumbs: [{ level: 1, label: 'Contexto' }],
      zoom: 1,
      isLoadingCodeDiagram: false,
      codeDiagramError: null,
    }),
}));
