import { create } from 'zustand';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
  fitnessScore?: number;
  moduleCount?: number;
  loc?: number;
  antipatternCount?: number;
}

interface RecentProjectsState {
  recentProjects: RecentProject[];
  addRecentProject: (project: Omit<RecentProject, 'lastOpened'> & { lastOpened?: string }) => void;
  removeRecentProject: (path: string) => void;
  clearRecentProjects: () => void;
}

const STORAGE_KEY = 'saac_recent_projects_v2';

function loadInitialRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error al cargar historial de proyectos recientes:', err);
  }
  return [];
}

function saveRecentProjects(projects: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Error al guardar historial de proyectos recientes:', err);
  }
}

export const useRecentProjectsStore = create<RecentProjectsState>((set) => ({
  recentProjects: loadInitialRecentProjects(),

  addRecentProject: (project) =>
    set((state) => {
      const now = new Date().toLocaleString();
      const name = project.name || project.path.split(/[/\\]/).pop() || 'Proyecto';

      // Filtrar duplicados por path
      const filtered = state.recentProjects.filter(
        (p) => p.path.toLowerCase() !== project.path.toLowerCase()
      );

      const updated: RecentProject[] = [
        {
          ...project,
          name,
          lastOpened: project.lastOpened || now,
        },
        ...filtered,
      ].slice(0, 10); // Conservar los 10 más recientes

      saveRecentProjects(updated);
      return { recentProjects: updated };
    }),

  removeRecentProject: (path) =>
    set((state) => {
      const updated = state.recentProjects.filter(
        (p) => p.path.toLowerCase() !== path.toLowerCase()
      );
      saveRecentProjects(updated);
      return { recentProjects: updated };
    }),

  clearRecentProjects: () => {
    saveRecentProjects([]);
    set({ recentProjects: [] });
  },
}));
