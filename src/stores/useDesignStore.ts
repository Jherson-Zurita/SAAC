import { create } from 'zustand';
import type {
  CanvasLayout,
  ComparisonReport,
  EdgeType,
  ExportFormat,
  NodePosition,
  ProposedArchitecture,
  ProposedArchitectureSummary,
  ProposedEdge,
  ProposedNode,
  ProposedNodeType,
} from '../../shared/types';
import {
  compareProposedArchitecture,
  createProposedArchitecture,
  deleteProposedArchitecture,
  exportProposedArchitecture,
  getProposedArchitecture,
  listProposedArchitectures,
  updateProposedArchitecture,
} from '../lib/tauri-api';

const MAX_HISTORY_LENGTH = 100;

export type DesignSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DesignHistorySnapshot {
  name: string;
  description: string | null;
  nodes: ProposedNode[];
  edges: ProposedEdge[];
  canvasLayout: CanvasLayout;
}

type ProposedNodeChanges = Partial<Omit<ProposedNode, 'id' | 'origin' | 'originalNodeId'>>;
type ProposedEdgeChanges = Partial<Omit<ProposedEdge, 'id' | 'origin' | 'originalEdgeId'>>;

interface DesignState {
  designs: ProposedArchitectureSummary[];
  currentDesign: ProposedArchitecture | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  history: DesignHistorySnapshot[];
  future: DesignHistorySnapshot[];
  isLoading: boolean;
  isDirty: boolean;
  saveStatus: DesignSaveStatus;
  error: string | null;
  comparisonReport: ComparisonReport | null;
  changeVersion: number;

  list: (projectPath: string) => Promise<ProposedArchitectureSummary[]>;
  open: (projectPath: string, designId: string) => Promise<ProposedArchitecture>;
  create: (
    projectPath: string,
    name: string,
    basedOnAnalysisRunId?: string | null,
    description?: string | null
  ) => Promise<ProposedArchitecture>;
  delete: (projectPath: string, designId: string) => Promise<void>;
  reset: () => void;

  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
  updateMetadata: (changes: { name?: string; description?: string | null }) => void;
  addNode: (
    nodeType: ProposedNodeType,
    label: string,
    position: NodePosition,
    properties?: Record<string, unknown>
  ) => ProposedNode | null;
  updateNode: (nodeId: string, changes: ProposedNodeChanges) => void;
  removeNodes: (nodeIds: string[]) => void;
  addEdge: (
    source: string,
    target: string,
    edgeType: EdgeType,
    label?: string,
    properties?: Record<string, unknown>
  ) => ProposedEdge | null;
  updateEdge: (edgeId: string, changes: ProposedEdgeChanges) => void;
  removeEdges: (edgeIds: string[]) => void;
  updateCanvasLayout: (layout: CanvasLayout) => void;

  undo: () => void;
  redo: () => void;
  save: (projectPath: string) => Promise<ProposedArchitecture | null>;
  compare: (projectPath: string, againstRunId: string) => Promise<ComparisonReport | null>;
  exportDesign: (projectPath: string, format: ExportFormat) => Promise<string | null>;
  clearError: () => void;
}

interface DesignDataState {
  designs: ProposedArchitectureSummary[];
  currentDesign: ProposedArchitecture | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  history: DesignHistorySnapshot[];
  future: DesignHistorySnapshot[];
  isLoading: boolean;
  isDirty: boolean;
  saveStatus: DesignSaveStatus;
  error: string | null;
  comparisonReport: ComparisonReport | null;
  changeVersion: number;
}

function createInitialState(): DesignDataState {
  return {
    designs: [],
    currentDesign: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    history: [],
    future: [],
    isLoading: false,
    isDirty: false,
    saveStatus: 'idle',
    error: null,
    comparisonReport: null,
    changeVersion: 0,
  };
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSnapshot(design: ProposedArchitecture): DesignHistorySnapshot {
  return cloneValue({
    name: design.name,
    description: design.description,
    nodes: design.nodes,
    edges: design.edges,
    canvasLayout: design.canvasLayout,
  });
}

function applySnapshot(
  design: ProposedArchitecture,
  snapshot: DesignHistorySnapshot
): ProposedArchitecture {
  const restored = cloneValue(snapshot);
  return {
    ...design,
    name: restored.name,
    description: restored.description,
    nodes: restored.nodes,
    edges: restored.edges,
    canvasLayout: restored.canvasLayout,
  };
}

function createLocalId(prefix: 'prop' | 'edge'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}_${randomUuid}`;

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${timestamp}_${randomPart}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toSummary(design: ProposedArchitecture): ProposedArchitectureSummary {
  return {
    schemaVersion: design.schemaVersion,
    id: design.id,
    projectId: design.projectId,
    name: design.name,
    description: design.description,
    basedOnAnalysisRunId: design.basedOnAnalysisRunId,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
    revision: design.revision,
    nodeCount: design.nodes.length,
    edgeCount: design.edges.length,
  };
}

function upsertSummary(
  designs: ProposedArchitectureSummary[],
  design: ProposedArchitecture
): ProposedArchitectureSummary[] {
  const summary = toSummary(design);
  const existingIndex = designs.findIndex((item) => item.id === design.id);

  if (existingIndex < 0) return [summary, ...designs];

  return designs.map((item, index) => (index === existingIndex ? summary : item));
}

function dirtySaveStatus(status: DesignSaveStatus): DesignSaveStatus {
  return status === 'saving' ? 'saving' : 'dirty';
}

export const useDesignStore = create<DesignState>((set, get) => {
  const commit = (
    update: (design: ProposedArchitecture) => ProposedArchitecture
  ): void => {
    set((state) => {
      if (!state.currentDesign) return state;

      const nextDesign = update(state.currentDesign);
      if (nextDesign === state.currentDesign) return state;

      return {
        currentDesign: nextDesign,
        history: [...state.history, createSnapshot(state.currentDesign)].slice(
          -MAX_HISTORY_LENGTH
        ),
        future: [],
        isDirty: true,
        saveStatus: dirtySaveStatus(state.saveStatus),
        error: null,
        comparisonReport: null,
        changeVersion: state.changeVersion + 1,
      };
    });
  };

  return {
    ...createInitialState(),

    list: async (projectPath) => {
      set({ isLoading: true, error: null });
      try {
        const designs = await listProposedArchitectures(projectPath);
        set({ designs, isLoading: false });
        return designs;
      } catch (error) {
        set({ isLoading: false, error: getErrorMessage(error) });
        throw error;
      }
    },

    open: async (projectPath, designId) => {
      set({ isLoading: true, error: null });
      try {
        const design = await getProposedArchitecture(projectPath, designId);
        set((state) => ({
          currentDesign: cloneValue(design),
          designs: upsertSummary(state.designs, design),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          history: [],
          future: [],
          isLoading: false,
          isDirty: false,
          saveStatus: 'saved',
          error: null,
          comparisonReport: null,
          changeVersion: 0,
        }));
        return design;
      } catch (error) {
        set({ isLoading: false, error: getErrorMessage(error) });
        throw error;
      }
    },

    create: async (
      projectPath,
      name,
      basedOnAnalysisRunId = null,
      description = null
    ) => {
      set({ isLoading: true, error: null });
      try {
        const design = await createProposedArchitecture(
          projectPath,
          name,
          basedOnAnalysisRunId,
          description
        );
        set((state) => ({
          currentDesign: cloneValue(design),
          designs: upsertSummary(state.designs, design),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          history: [],
          future: [],
          isLoading: false,
          isDirty: false,
          saveStatus: 'saved',
          error: null,
          comparisonReport: null,
          changeVersion: 0,
        }));
        return design;
      } catch (error) {
        set({ isLoading: false, error: getErrorMessage(error) });
        throw error;
      }
    },

    delete: async (projectPath, designId) => {
      set({ error: null });
      try {
        await deleteProposedArchitecture(projectPath, designId);
        set((state) => {
          const deletesCurrent = state.currentDesign?.id === designId;
          return {
            designs: state.designs.filter((item) => item.id !== designId),
            ...(deletesCurrent
              ? {
                  currentDesign: null,
                  selectedNodeIds: [],
                  selectedEdgeIds: [],
                  history: [],
                  future: [],
                  isDirty: false,
                  saveStatus: 'idle' as DesignSaveStatus,
                  comparisonReport: null,
                  changeVersion: 0,
                }
              : {}),
          };
        });
      } catch (error) {
        set({ error: getErrorMessage(error) });
        throw error;
      }
    },

    reset: () => set(createInitialState()),

    setSelection: (selectedNodeIds, selectedEdgeIds) =>
      set({
        selectedNodeIds: [...new Set(selectedNodeIds)],
        selectedEdgeIds: [...new Set(selectedEdgeIds)],
      }),

    clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

    updateMetadata: (changes) =>
      commit((design) => ({
        ...design,
        ...changes,
      })),

    addNode: (nodeType, label, position, properties = {}) => {
      if (!get().currentDesign) return null;

      const node: ProposedNode = {
        id: createLocalId('prop'),
        origin: 'proposed',
        nodeType,
        label,
        modified: false,
        properties: cloneValue(properties),
        position: { ...position },
      };

      commit((design) => ({
        ...design,
        nodes: [...design.nodes, node],
      }));
      return node;
    },

    updateNode: (nodeId, changes) =>
      commit((design) => {
        const node = design.nodes.find((item) => item.id === nodeId);
        if (!node) return design;

        const nextChanges = cloneValue(changes);
        const updatedNode: ProposedNode = {
          ...node,
          ...nextChanges,
          modified:
            nextChanges.modified ?? (node.origin === 'imported' ? true : node.modified),
        };

        return {
          ...design,
          nodes: design.nodes.map((item) => (item.id === nodeId ? updatedNode : item)),
        };
      }),

    removeNodes: (nodeIds) => {
      const ids = new Set(nodeIds);
      if (ids.size === 0) return;

      commit((design) => {
        if (!design.nodes.some((node) => ids.has(node.id))) return design;
        return {
          ...design,
          nodes: design.nodes.filter((node) => !ids.has(node.id)),
          edges: design.edges.filter(
            (edge) => !ids.has(edge.source) && !ids.has(edge.target)
          ),
        };
      });
      set((state) => ({
        selectedNodeIds: state.selectedNodeIds.filter((id) => !ids.has(id)),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) =>
          get().currentDesign?.edges.some((edge) => edge.id === id)
        ),
      }));
    },

    addEdge: (source, target, edgeType, label, properties = {}) => {
      const design = get().currentDesign;
      if (!design || source === target) return null;

      const nodeIds = new Set(design.nodes.map((node) => node.id));
      if (!nodeIds.has(source) || !nodeIds.has(target)) return null;

      const duplicate = design.edges.some(
        (edge) =>
          edge.source === source && edge.target === target && edge.edgeType === edgeType
      );
      if (duplicate) return null;

      const edge: ProposedEdge = {
        id: createLocalId('edge'),
        origin: 'proposed',
        source,
        target,
        edgeType,
        ...(label === undefined ? {} : { label }),
        modified: false,
        properties: cloneValue(properties),
      };

      commit((current) => ({
        ...current,
        edges: [...current.edges, edge],
      }));
      return edge;
    },

    updateEdge: (edgeId, changes) =>
      commit((design) => {
        const edge = design.edges.find((item) => item.id === edgeId);
        if (!edge) return design;

        const nextChanges = cloneValue(changes);
        const source = nextChanges.source ?? edge.source;
        const target = nextChanges.target ?? edge.target;
        const edgeType = nextChanges.edgeType ?? edge.edgeType;
        const nodeIds = new Set(design.nodes.map((node) => node.id));

        if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) {
          return design;
        }

        const duplicate = design.edges.some(
          (item) =>
            item.id !== edgeId &&
            item.source === source &&
            item.target === target &&
            item.edgeType === edgeType
        );
        if (duplicate) return design;

        const updatedEdge: ProposedEdge = {
          ...edge,
          ...nextChanges,
          source,
          target,
          edgeType,
          modified:
            nextChanges.modified ?? (edge.origin === 'imported' ? true : edge.modified),
        };

        return {
          ...design,
          edges: design.edges.map((item) => (item.id === edgeId ? updatedEdge : item)),
        };
      }),

    removeEdges: (edgeIds) => {
      const ids = new Set(edgeIds);
      if (ids.size === 0) return;

      commit((design) => {
        if (!design.edges.some((edge) => ids.has(edge.id))) return design;
        return {
          ...design,
          edges: design.edges.filter((edge) => !ids.has(edge.id)),
        };
      });
      set((state) => ({
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => !ids.has(id)),
      }));
    },

    updateCanvasLayout: (canvasLayout) =>
      commit((design) => ({
        ...design,
        canvasLayout: cloneValue(canvasLayout),
      })),

    undo: () =>
      set((state) => {
        if (!state.currentDesign || state.history.length === 0) return state;

        const previous = state.history[state.history.length - 1];
        return {
          currentDesign: applySnapshot(state.currentDesign, previous),
          history: state.history.slice(0, -1),
          future: [createSnapshot(state.currentDesign), ...state.future].slice(
            0,
            MAX_HISTORY_LENGTH
          ),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          isDirty: true,
          saveStatus: dirtySaveStatus(state.saveStatus),
          error: null,
          comparisonReport: null,
          changeVersion: state.changeVersion + 1,
        };
      }),

    redo: () =>
      set((state) => {
        if (!state.currentDesign || state.future.length === 0) return state;

        const next = state.future[0];
        return {
          currentDesign: applySnapshot(state.currentDesign, next),
          history: [...state.history, createSnapshot(state.currentDesign)].slice(
            -MAX_HISTORY_LENGTH
          ),
          future: state.future.slice(1),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          isDirty: true,
          saveStatus: dirtySaveStatus(state.saveStatus),
          error: null,
          comparisonReport: null,
          changeVersion: state.changeVersion + 1,
        };
      }),

    save: async (projectPath) => {
      const stateBeforeSave = get();
      const design = stateBeforeSave.currentDesign;
      if (!design || stateBeforeSave.saveStatus === 'saving') return null;

      const savedChangeVersion = stateBeforeSave.changeVersion;
      set({ saveStatus: 'saving', error: null });

      try {
        const saved = await updateProposedArchitecture(
          projectPath,
          design.id,
          cloneValue(design)
        );

        set((state) => {
          if (!state.currentDesign || state.currentDesign.id !== design.id) return state;

          const changedDuringSave = state.changeVersion !== savedChangeVersion;
          const effectiveDesign = changedDuringSave
            ? {
                ...state.currentDesign,
                schemaVersion: saved.schemaVersion,
                projectId: saved.projectId,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                revision: saved.revision,
              }
            : cloneValue(saved);

          return {
            currentDesign: effectiveDesign,
            designs: upsertSummary(state.designs, effectiveDesign),
            isDirty: changedDuringSave,
            saveStatus: changedDuringSave ? 'dirty' : 'saved',
            error: null,
          };
        });

        return saved;
      } catch (error) {
        set((state) =>
          state.currentDesign?.id === design.id
            ? {
                isDirty: true,
                saveStatus: 'error',
                error: getErrorMessage(error),
              }
            : state
        );
        throw error;
      }
    },

    compare: async (projectPath, againstRunId) => {
      const designId = get().currentDesign?.id;
      if (!designId) return null;

      set({ error: null });
      try {
        const comparisonReport = await compareProposedArchitecture(
          projectPath,
          designId,
          againstRunId
        );
        if (get().currentDesign?.id === designId) set({ comparisonReport });
        return comparisonReport;
      } catch (error) {
        set({ error: getErrorMessage(error) });
        throw error;
      }
    },

    exportDesign: async (projectPath, format) => {
      const designId = get().currentDesign?.id;
      if (!designId) return null;

      set({ error: null });
      try {
        return await exportProposedArchitecture(projectPath, designId, format);
      } catch (error) {
        set({ error: getErrorMessage(error) });
        throw error;
      }
    },

    clearError: () =>
      set((state) => ({
        error: null,
        saveStatus: state.saveStatus === 'error' ? 'dirty' : state.saveStatus,
      })),
  };
});
