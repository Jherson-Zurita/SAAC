import { create } from 'zustand';

export type SelectionType =
  | 'module'
  | 'container'
  | 'external-system'
  | 'actor'
  | 'antipattern'
  | 'dependency'
  | 'class'
  | 'function'
  | 'c4_node';

interface SelectionState {
  selectedId: string | null;
  selectedType: SelectionType | null;
  selectedData: unknown | null;

  selectElement: (id: string | null, type?: SelectionType | null, data?: unknown) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  selectedType: null,
  selectedData: null,

  selectElement: (id, type = null, data = null) =>
    set({
      selectedId: id,
      selectedType: type,
      selectedData: data,
    }),

  clearSelection: () =>
    set({
      selectedId: null,
      selectedType: null,
      selectedData: null,
    }),
}));
