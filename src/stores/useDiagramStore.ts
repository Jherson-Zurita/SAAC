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

  setC4Level: (level: C4Level, containerId?: string | null, moduleId?: string | null, label?: string) => void;
  setCodeDiagramData: (data: C4DiagramData | null) => void;
  navigateToBreadcrumb: (index: number) => void;
  setZoom: (zoom: number) => void;
  resetDiagram: () => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  c4Level: 1,
  activeContainerId: null,
  activeModuleId: null,
  codeDiagramData: null,
  breadcrumbs: [{ level: 1, label: 'Contexto (Nivel 1)' }],
  zoom: 1,

  setC4Level: (level, containerId = null, moduleId = null, label) =>
    set((state) => {
      let defaultLabel = `Nivel ${level}`;
      if (level === 1) defaultLabel = 'Contexto (Nivel 1)';
      if (level === 2) defaultLabel = 'Contenedores (Nivel 2)';
      if (level === 3) defaultLabel = `Componentes (${containerId || 'Contenedor'})`;
      if (level === 4) defaultLabel = `Código (${moduleId || 'Módulo'})`;

      const newBreadcrumb: BreadcrumbItem = {
        level,
        label: label || defaultLabel,
        containerId: containerId || undefined,
        moduleId: moduleId || undefined,
      };

      // Recortar o extender breadcrumb
      const existingIdx = state.breadcrumbs.findIndex((b) => b.level === level);
      let newBreadcrumbs: BreadcrumbItem[];
      if (existingIdx >= 0) {
        newBreadcrumbs = [...state.breadcrumbs.slice(0, existingIdx), newBreadcrumb];
      } else {
        newBreadcrumbs = [...state.breadcrumbs, newBreadcrumb];
      }

      return {
        c4Level: level,
        activeContainerId: containerId,
        activeModuleId: moduleId,
        breadcrumbs: newBreadcrumbs,
      };
    }),

  setCodeDiagramData: (codeDiagramData) => set({ codeDiagramData }),

  navigateToBreadcrumb: (index) =>
    set((state) => {
      const target = state.breadcrumbs[index];
      if (!target) return state;
      return {
        c4Level: target.level,
        activeContainerId: target.containerId || null,
        activeModuleId: target.moduleId || null,
        breadcrumbs: state.breadcrumbs.slice(0, index + 1),
      };
    }),

  setZoom: (zoom) => set({ zoom }),

  resetDiagram: () =>
    set({
      c4Level: 1,
      activeContainerId: null,
      activeModuleId: null,
      codeDiagramData: null,
      breadcrumbs: [{ level: 1, label: 'Contexto (Nivel 1)' }],
      zoom: 1,
    }),
}));
