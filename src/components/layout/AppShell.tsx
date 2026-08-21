import React from 'react';
import { TopBar } from './TopBar';
import { Leftbar } from './Leftbar';
import { Rightbar } from './Rightbar';
import { Downbar } from './Downbar';
import { StatusBar } from './StatusBar';
import { BreadcrumbBar } from './BreadcrumbBar';
import { Dashboard } from '../dashboard';
import { MetricsPanel } from '../metrics';
import { C4Viewer } from '../c4viewer';
import { isDiagramTab } from '../c4viewer/diagram-registry';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useRecentProjectsStore } from '../../stores/useRecentProjectsStore';
import { useAnalysisHistoryStore } from '../../stores/useAnalysisHistoryStore';
import {
  FolderOpen,
  Sparkles,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  History,
  Trash2,
  FolderGit2,
  ArrowRight,
  Clock,
} from 'lucide-react';

import { AntipatternsPanel } from '../antipatterns';
import { AdrsPanel } from '../adrs';
import { DesignWorkspace } from '../design';

interface AppShellProps {
  onOpenProject: () => void;
  onOpenProjectByPath?: (path: string) => void;
  onCloseProject?: () => void;
  onAnalyzeProject: () => void;
  onCancelAnalysis: () => void;
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  onOpenProject,
  onOpenProjectByPath,
  onCloseProject,
  onAnalyzeProject,
  onCancelAnalysis,
  children,
}) => {
  const { activeMainTab } = useUiStore();
  const { amg, projectPath } = useProjectStore();
  const { history } = useAnalysisHistoryStore();
  const { recentProjects, removeRecentProject, clearRecentProjects } = useRecentProjectsStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden select-none transition-colors duration-200">
      {/* 1. TopBar Header (Height 48px) */}
      <TopBar
        onOpenProject={onOpenProject}
        onAnalyzeProject={onAnalyzeProject}
        onCancelAnalysis={onCancelAnalysis}
        onCloseProject={onCloseProject}
      />

      {/* 2. Breadcrumb Bar */}
      <BreadcrumbBar />

      {/* 3. Central Region: ActivityBar + Explorer + Main Canvas + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Bar (Activity Bar 46px + Explorer 218px) */}
        <Leftbar />

        {/* MAIN WORKSPACE CANVAS (GraphForge Spec Section 14) */}
        <main className="flex-1 flex flex-col bg-[var(--diagram-canvas)] overflow-hidden relative">
          {children ? (
            children
          ) : !amg ? (
            /* Welcome View when no project loaded (GraphForge Styling) */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-y-auto font-sans">
              {/* Radial Backdrop Glow */}
              <div className="absolute w-[500px] h-[500px] bg-[var(--purple)]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl w-full space-y-5 flex flex-col items-center">
                {/* Hero Badge */}
                <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-[var(--purple-soft)] border border-[var(--purple-border)] text-[var(--purple)] text-[10px] font-semibold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plataforma de Auditoría &amp; Arquitectura Multilenguaje</span>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">
                    Sistema de Análisis de Arquitectura de Código
                  </h1>
                  <p className="text-xs text-[var(--muted)] max-w-lg mx-auto leading-relaxed">
                    Motor de análisis estático AST para TypeScript, Python, Java, Go, Rust, C#, Kotlin y Swift. Modelo C4 interactivo, Fitness Functions e IA integrada.
                  </p>
                </div>

                {/* Primary Action CTA */}
                <div className="pt-1">
                  <button
                    onClick={onOpenProject}
                    className="flex items-center space-x-2 px-5 py-2 bg-[var(--purple-soft)] hover:bg-[var(--purple)] hover:text-white text-[var(--purple)] font-semibold text-xs rounded border border-[var(--purple-border)] shadow-lg transition transform hover:-translate-y-0.5"
                  >
                    <FolderOpen className="w-4 h-4 text-[var(--cyan)]" />
                    <span>Seleccionar Carpeta de Proyecto</span>
                  </button>
                </div>

                {/* Recent Projects List */}
                <div className="w-full bg-[var(--panel)] rounded-md border border-[var(--border)] p-4 text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <div className="flex items-center space-x-2">
                      <History className="w-3.5 h-3.5 text-[var(--cyan)]" />
                      <h3 className="text-xs font-bold text-[var(--text)]">
                        Proyectos Recientes ({recentProjects.length})
                      </h3>
                    </div>
                    {recentProjects.length > 0 && (
                      <button
                        onClick={clearRecentProjects}
                        className="text-[10px] text-[var(--muted-2)] hover:text-[var(--red)] transition flex items-center space-x-1"
                        title="Limpiar historial de recientes"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Limpiar historial</span>
                      </button>
                    )}
                  </div>

                  {recentProjects.length === 0 ? (
                    <div className="p-4 text-center text-[var(--muted-2)] text-xs space-y-1">
                      <FolderGit2 className="w-7 h-7 opacity-30 text-[var(--purple)] mx-auto mb-1" />
                      <p className="font-semibold text-[var(--muted)]">Sin historial de proyectos recientes.</p>
                      <p className="text-[10px] text-[var(--muted-2)]">
                        Seleccione una carpeta para iniciar el primer análisis.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {recentProjects.map((p) => (
                        <div
                          key={p.path}
                          onClick={() => onOpenProjectByPath?.(p.path)}
                          className="group p-2.5 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] border border-[var(--border-soft)] hover:border-[var(--purple)]/50 cursor-pointer transition flex items-center justify-between"
                        >
                          <div className="space-y-0.5 overflow-hidden pr-2">
                            <div className="flex items-center space-x-1.5">
                              <FolderGit2 className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" />
                              <span className="font-semibold text-xs text-[var(--text)] group-hover:text-[var(--purple)] truncate">
                                {p.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-[var(--muted-2)] font-mono truncate" title={p.path}>
                              {p.path}
                            </p>

                            <div className="flex items-center space-x-2 text-[9px] font-mono text-[var(--muted-2)] pt-0.5">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{p.lastOpened}</span>
                              </span>
                              {p.fitnessScore !== undefined && (
                                <span className="px-1 py-0.2 rounded bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 font-bold">
                                  FS: {p.fitnessScore}/100
                                </span>
                              )}
                              {p.moduleCount !== undefined && (
                                <span>• {p.moduleCount} mód</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentProject(p.path);
                              }}
                              className="p-1 text-[var(--muted-2)] hover:text-[var(--red)] rounded transition opacity-0 group-hover:opacity-100"
                              title="Quitar de recientes"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-2)] group-hover:text-[var(--purple)] transition transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-3 gap-2.5 w-full pt-1 text-left text-xs">
                  <div className="bg-[var(--panel)] p-3 rounded-md border border-[var(--border)] hover:border-[var(--purple)]/40 transition">
                    <div className="text-[var(--cyan)] font-semibold flex items-center space-x-1.5 mb-1">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Dashboard &amp; Métricas</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)]">
                      Acoplamiento ($Ca, Ce$), instabilidad ($I$), abstractness ($A$) y distancia ($D$).
                    </p>
                  </div>

                  <div className="bg-[var(--panel)] p-3 rounded-md border border-[var(--border)] hover:border-[var(--purple)]/40 transition">
                    <div className="text-[var(--purple)] font-semibold flex items-center space-x-1.5 mb-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Modelo C4 + 19 Vistas</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)]">
                      C4 Niveles 1-4, Secuencia, DFD, Call Graph, Herencia y ER generados.
                    </p>
                  </div>

                  <div className="bg-[var(--panel)] p-3 rounded-md border border-[var(--border)] hover:border-[var(--purple)]/40 transition">
                    <div className="text-[var(--green)] font-semibold flex items-center space-x-1.5 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Fitness Functions</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)]">
                      Evaluación configurable de reglas con cálculo de Fitness Score (0-100).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeMainTab === 'dashboard' ? (
            <Dashboard />
          ) : activeMainTab === 'metrics' ? (
            <MetricsPanel />
          ) : activeMainTab === 'antipatterns' ? (
            <AntipatternsPanel />
          ) : activeMainTab === 'adrs' ? (
            <AdrsPanel />
          ) : activeMainTab === 'design' ? (
            <DesignWorkspace
              projectPath={projectPath || ''}
              analysisRuns={history?.runs || []}
            />
          ) : isDiagramTab(activeMainTab) ? (
            <C4Viewer activeTab={activeMainTab} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#858C98]">
              <p>Pestaña Activa: <span className="font-bold text-[#8B7CFF] uppercase">{activeMainTab}</span></p>
            </div>
          )}
        </main>

        {/* Right Bar (Inspector 275px) */}
        <Rightbar />
      </div>

      {/* Downbar (Bottom Panel 166px) */}
      <Downbar />

      {/* StatusBar (Height 23px) */}
      <StatusBar />
    </div>
  );
};
