// Zustand store placeholder
// En el futuro usará import { create } from 'zustand';

export interface AppState {
  currentProject: string | null;
  setCurrentProject: (project: string | null) => void;
}

// Placeholder simple hasta que zustand esté configurado
export const useAppStore = {
  currentProject: null as string | null,
  setCurrentProject: (project: string | null) => {
    console.log("Setting project to:", project);
  }
};
