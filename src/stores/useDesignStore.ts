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
import {
  extractFragment,
  type DesignFragment,
} from '../components/design/design-flow';

const MAX_HISTORY_LENGTH = 100;
const PASTE_OFFSET = 40;

export type DesignSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DesignHistorySnapshot {
  name: string;
  description: string | null;
  nodes: ProposedNode[];
  edges: ProposedEdge[];
}

export interface DesignFocusRequest {
  nodeIds: string[];
  edgeIds: string[];
  nonce: number;
}

type ProposedNodeChanges = Partial<Omit<ProposedNode, 'id' | 'origin' | 'originalNodeId'>>;
type ProposedEdgeChanges = Partial<Omit<ProposedEdge, 'id' | 'origin' | 'originalEdgeId'>>;

interface DesignState {
  projectPath: string | null;
  hasLoadedList: boolean;
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
  clipboard: DesignFragment | null;
  pasteCount: number;
  focusRequest: DesignFocusRequest | null;
  editingNodeId: string | null;

  ensureProject: (projectPath: string) => void;
  list: (projectPath: string) => Promise<ProposedArchitectureSummary[]>;
  open: (projectPath: string, designId: string) => Promise<ProposedArchitecture>;
  create: (
    projectPath: string,
    name: string,
    basedOnAnalysisRunId?: string | null,
    description?: string | null
  ) => Promise<ProposedArchitecture>;
  duplicate: (projectPath: string, designId: string) => Promise<ProposedArchitecture>;
  delete: (projectPath: string, designId: string) => Promise<void>;
  reset: () => void;

  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  focusNodes: (nodeIds: string[], edgeIds?: string[]) => void;
  setEditingNode: (nodeId: string | null) => void;
  updateMetadata: (changes: { name?: string; description?: string | null }) => void;
  addNode: (
    nodeType: ProposedNodeType,
    label: string,
    position: NodePosition,
    properties?: Record<string, unknown>
  ) => ProposedNode | null;
  updateNode: (nodeId: string, changes: ProposedNodeChanges) => void;
  moveNodes: (positions: Record<string, NodePosition>) => void;
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
  removeSelection: () => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  insertFragment: (fragment: DesignFragment) => ProposedNode[];
  copySelection: () => boolean;
  paste: () => ProposedNode[];
  duplicateSelection: () => ProposedNode[];
  updateCanvasLayout: (layout: CanvasLayout) => void;

  undo: () => void;
  redo: () => void;
  save: (projectPath: string) => Promise<ProposedArchitecture | null>;
  compare: (projectPath: string, againstRunId: string) => Promise<ComparisonReport | null>;
  clearComparison: () => void;
  exportDesign: (projectPath: string, format: ExportFormat) => Promise<string | null>;
  clearError: () => void;
}

type DesignDataState = Omit<
  DesignState,
  {
    [K in keyof DesignState]: DesignState[K] extends (...args: never[]) => unknown ? K : never;
  }[keyof DesignState]
>;

function createInitialState(projectPath: string | null = null): DesignDataState {
  return {
    projectPath,
    hasLoadedList: false,
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
    clipboard: null,
    pasteCount: 0,
    focusRequest: null,
    editingNodeId: null,
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

function openedDesignState(design: ProposedArchitecture) {
  return {
    currentDesign: cloneValue(design),
    selectedNodeIds: [] as string[],
    selectedEdgeIds: [] as string[],
    history: [] as DesignHistorySnapshot[],
    future: [] as DesignHistorySnapshot[],
    isLoading: false,
    isDirty: false,
    saveStatus: 'saved' as DesignSaveStatus,
    error: null,
    comparisonReport: null,
    changeVersion: 0,
    pasteCount: 0,
    focusRequest: null,
    editingNodeId: null,
  };
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

  const flushPendingChanges = async (projectPath: string) => {
    if (get().isDirty) await get().save(projectPath).catch(() => undefined);
  };

  return {
    ...createInitialState(),

    ensureProject: (projectPath) => {
      if (get().projectPath !== projectPath) set(createInitialState(projectPath));
    },

    list: async (projectPath) => {
      set({ isLoading: true, error: null });
      try {
        const designs = await listProposedArchitectures(projectPath);
        set({ designs, isLoading: false, hasLoadedList: true });
        return designs;
      } catch (error) {
        set({ isLoading: false, hasLoadedList: true, error: getErrorMessage(error) });
        throw error;
      }
    },

    open: async (projectPath, designId) => {
      if (get().currentDesign?.id === designId) return get().currentDesign!;
      await flushPendingChanges(projectPath);
      set({ isLoading: true, error: null });
      try {
        const design = await getProposedArchitecture(projectPath, designId);
        set((state) => ({
          ...openedDesignState(design),
          designs: upsertSummary(state.designs, design),
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
      await flushPendingChanges(projectPath);
      set({ isLoading: true, error: null });
      try {
        const design = await createProposedArchitecture(
          projectPath,
          name,
          basedOnAnalysisRunId,
          description
        );
        set((state) => ({
          ...openedDesignState(design),
          designs: upsertSummary(state.designs, design),
        }));
        return design;
      } catch (error) {
        set({ isLoading: false, error: getErrorMessage(error) });
        throw error;
      }
    },

    duplicate: async (projectPath, designId) => {
      await flushPendingChanges(projectPath);
      set({ isLoading: true, error: null });
      try {
        const current = get().currentDesign;
        const source =
          current?.id === designId
            ? cloneValue(current)
            : await getProposedArchitecture(projectPath, designId);
        const created = await createProposedArchitecture(
          projectPath,
          `${source.name} (copia)`,
          source.basedOnAnalysisRunId,
          source.description
        );
        const saved = await updateProposedArchitecture(projectPath, created.id, {
          ...created,
          nodes: source.nodes,
          edges: source.edges,
          canvasLayout: source.canvasLayout,
        });
        set((state) => ({
          ...openedDesignState(saved),
          designs: upsertSummary(state.designs, saved),
        }));
        return saved;
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
                  editingNodeId: null,
                }
              : {}),
          };
        });
      } catch (error) {
        set({ error: getErrorMessage(error) });
        throw error;
      }
    },

    reset: () => set(createInitialState(get().projectPath)),

    setSelection: (selectedNodeIds, selectedEdgeIds) =>
      set({
        selectedNodeIds: [...new Set(selectedNodeIds)],
        selectedEdgeIds: [...new Set(selectedEdgeIds)],
      }),

    clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

    selectAll: () => {
      const design = get().currentDesign;
      if (!design) return;
      set({
        selectedNodeIds: design.nodes.map((node) => node.id),
        selectedEdgeIds: [],
      });
    },

    focusNodes: (nodeIds, edgeIds = []) => {
      const design = get().currentDesign;
      if (!design) return;
      const existingNodes = new Set(design.nodes.map((node) => node.id));
      const existingEdges = new Set(design.edges.map((edge) => edge.id));
      const validNodeIds = nodeIds.filter((id) => existingNodes.has(id));
      const validEdgeIds = edgeIds.filter((id) => existingEdges.has(id));
      if (validNodeIds.length === 0 && validEdgeIds.length === 0) return;

      set((state) => ({
        selectedNodeIds: validNodeIds,
        selectedEdgeIds: validEdgeIds,
        focusRequest: {
          nodeIds: validNodeIds,
          edgeIds: validEdgeIds,
          nonce: (state.focusRequest?.nonce ?? 0) + 1,
        },
      }));
    },

    setEditingNode: (editingNodeId) => set({ editingNodeId }),

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

    moveNodes: (positions) =>
      commit((design) => {
        let changed = false;
        const nodes = design.nodes.map((node) => {
          const next = positions[node.id];
          if (
            !next ||
            !Number.isFinite(next.x) ||
            !Number.isFinite(next.y) ||
            (next.x === node.position.x && next.y === node.position.y)
          ) {
            return node;
          }
          changed = true;
          return { ...node, position: { x: next.x, y: next.y } };
        });
        return changed ? { ...design, nodes } : design;
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
      set((state) => {
        const remainingEdges = new Set(state.currentDesign?.edges.map((edge) => edge.id));
        return {
          selectedNodeIds: state.selectedNodeIds.filter((id) => !ids.has(id)),
          selectedEdgeIds: state.selectedEdgeIds.filter((id) => remainingEdges.has(id)),
          editingNodeId:
            state.editingNodeId && ids.has(state.editingNodeId) ? null : state.editingNodeId,
        };
      });
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

    removeSelection: () => {
      const { selectedNodeIds, selectedEdgeIds } = get();
      get().removeElements(selectedNodeIds, selectedEdgeIds);
    },

    removeElements: (nodeIdList, edgeIdList) => {
      const nodeIds = new Set(nodeIdList);
      const edgeIds = new Set(edgeIdList);
      if (nodeIds.size === 0 && edgeIds.size === 0) return;

      commit((design) => {
        const nodes = design.nodes.filter((node) => !nodeIds.has(node.id));
        const edges = design.edges.filter(
          (edge) =>
            !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
        );
        if (nodes.length === design.nodes.length && edges.length === design.edges.length) {
          return design;
        }
        return { ...design, nodes, edges };
      });
      set((state) => ({
        selectedNodeIds: state.selectedNodeIds.filter((id) => !nodeIds.has(id)),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => !edgeIds.has(id)),
        editingNodeId:
          state.editingNodeId && nodeIds.has(state.editingNodeId) ? null : state.editingNodeId,
      }));
    },

    insertFragment: (fragment) => {
      if (!get().currentDesign || fragment.nodes.length === 0) return [];

      const idByKey = new Map<string, string>();
      const nodes: ProposedNode[] = fragment.nodes.map((item) => {
        const id = createLocalId('prop');
        idByKey.set(item.key, id);
        return {
          id,
          origin: 'proposed',
          nodeType: item.nodeType,
          label: item.label,
          modified: false,
          properties: cloneValue(item.properties),
          position: { ...item.position },
        };
      });
      const edges: ProposedEdge[] = fragment.edges.flatMap((item) => {
        const source = idByKey.get(item.source);
        const target = idByKey.get(item.target);
        if (!source || !target || source === target) return [];
        return [
          {
            id: createLocalId('edge'),
            origin: 'proposed' as const,
            source,
            target,
            edgeType: item.edgeType,
            ...(item.label ? { label: item.label } : {}),
            modified: false,
            properties: cloneValue(item.properties),
          },
        ];
      });

      commit((design) => ({
        ...design,
        nodes: [...design.nodes, ...nodes],
        edges: [...design.edges, ...edges],
      }));
      set({ selectedNodeIds: nodes.map((node) => node.id), selectedEdgeIds: [] });
      return nodes;
    },

    copySelection: () => {
      const { currentDesign, selectedNodeIds } = get();
      if (!currentDesign) return false;
      const fragment = extractFragment(currentDesign, selectedNodeIds);
      if (!fragment) return false;
      set({ clipboard: fragment, pasteCount: 0 });
      return true;
    },

    paste: () => {
      const { clipboard, pasteCount } = get();
      if (!clipboard) return [];
      const offset = PASTE_OFFSET * (pasteCount + 1);
      const inserted = get().insertFragment({
        ...clipboard,
        nodes: clipboard.nodes.map((node) => ({
          ...node,
          position: { x: node.position.x + offset, y: node.position.y + offset },
        })),
      });
      if (inserted.length > 0) set({ pasteCount: pasteCount + 1 });
      return inserted;
    },

    duplicateSelection: () => {
      const { currentDesign, selectedNodeIds } = get();
      if (!currentDesign) return [];
      const fragment = extractFragment(currentDesign, selectedNodeIds);
      if (!fragment) return [];
      return get().insertFragment({
        ...fragment,
        nodes: fragment.nodes.map((node) => ({
          ...node,
          position: { x: node.position.x + PASTE_OFFSET, y: node.position.y + PASTE_OFFSET },
        })),
      });
    },

    updateCanvasLayout: (canvasLayout) =>
      set((state) =>
        state.currentDesign
          ? { currentDesign: { ...state.currentDesign, canvasLayout: cloneValue(canvasLayout) } }
          : state
      ),

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
          editingNodeId: null,
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
          editingNodeId: null,
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
            : {
                ...cloneValue(saved),
                canvasLayout: state.currentDesign.canvasLayout,
              };

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

    clearComparison: () => set({ comparisonReport: null }),

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
