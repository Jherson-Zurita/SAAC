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
    <div className="h-screen w-screen flex flex-col bg-[#090b10] text-gray-100 font-sans overflow-hidden select-none">
      {/* TopBar Header */}
      <TopBar
        onOpenProject={onOpenProject}
        onAnalyzeProject={onAnalyzeProject}
        onCancelAnalysis={onCancelAnalysis}
        onCloseProject={onCloseProject}
      />

      {/* Breadcrumb Bar para navegación C4 */}
      <BreadcrumbBar />

      {/* Región Central: Leftbar + Main Canvas + Rightbar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Panel Izquierdo (Explorador / Jerarquía) */}
        <Leftbar />

        {/* ÁREA CENTRAL MAIN CANVAS */}
        <main className="flex-1 flex flex-col bg-[#0d0f17] overflow-hidden relative">
          {children ? (
            children
          ) : !amg ? (
            /* Vista de bienvenida cuando no hay proyecto */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-y-auto">
              {/* Radial backdrop glow */}
              <div className="absolute w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-4xl w-full space-y-6 flex flex-col items-center">
                {/* Hero Badge */}
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plataforma de Auditoría &amp; Arquitectura Multilenguaje</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                    Sistema de Análisis de Arquitectura de Código
                  </h1>
                  <p className="text-xs text-gray-400 max-w-lg mx-auto leading-relaxed font-normal">
                    Motor de análisis estático AST para 8 lenguajes (TypeScript, Python, Java, Go, Rust, C#, Kotlin, Swift). Modelo C4 interactivo, Fitness Functions e IA local integrada.
                  </p>
                </div>

                {/* Primary CTA */}
                <div className="pt-1">
                  <button
                    onClick={onOpenProject}
                    className="flex items-center space-x-2.5 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Seleccionar Carpeta de Proyecto</span>
                  </button>
                </div>

                {/* Sección de Proyectos & Análisis Recientes (Estilo VS Code) */}
                <div className="w-full bg-[#121520] rounded-2xl border border-[#1e2333] p-5 shadow-xl text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1e2333] pb-3">
                    <div className="flex items-center space-x-2">
                      <History className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-bold text-gray-200">
                        Proyectos Recientes ({recentProjects.length})
                      </h3>
                    </div>
                    {recentProjects.length > 0 && (
                      <button
                        onClick={clearRecentProjects}
                        className="text-[10px] text-gray-500 hover:text-rose-400 transition flex items-center space-x-1"
                        title="Limpiar historial de recientes"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Limpiar historial</span>
                      </button>
                    )}
                  </div>

                  {recentProjects.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs space-y-1">
                      <FolderGit2 className="w-8 h-8 opacity-30 text-cyan-400 mx-auto mb-1" />
                      <p className="font-semibold text-gray-400">Sin historial de proyectos recientes.</p>
                      <p className="text-[10px] text-gray-600">
                        Seleccione una carpeta arriba para iniciar el primer análisis de código.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {recentProjects.map((p) => (
                        <div
                          key={p.path}
                          onClick={() => onOpenProjectByPath?.(p.path)}
                          className="group p-3 rounded-xl bg-[#161a26] hover:bg-[#1f2638] border border-[#232a3e] hover:border-cyan-500/40 cursor-pointer transition flex items-center justify-between relative"
                        >
                          <div className="space-y-1 overflow-hidden pr-2">
                            <div className="flex items-center space-x-2">
                              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="font-bold text-xs text-gray-200 group-hover:text-white truncate">
                                {p.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono truncate" title={p.path}>
                              {p.path}
                            </p>

                            <div className="flex items-center space-x-2 text-[9px] font-mono text-gray-400 pt-0.5">
                              <span className="flex items-center space-x-1 text-gray-400">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{p.lastOpened}</span>
                              </span>
                              {p.fitnessScore !== undefined && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
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
                              className="p-1 text-gray-500 hover:text-rose-400 hover:bg-[#251d24] rounded transition opacity-0 group-hover:opacity-100"
                              title="Quitar de recientes"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-3 gap-3 w-full pt-2 text-left text-xs">
                  <div className="bg-[#121520] p-3.5 rounded-xl border border-[#1e2333] hover:border-blue-500/40 transition group">
                    <div className="text-cyan-400 font-bold flex items-center space-x-2 mb-1">
                      <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Dashboard &amp; Métricas</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      Acoplamiento ($Ca, Ce$), instabilidad ($I$), abstractness ($A$) y distancia ($D$).
                    </p>
                  </div>

                  <div className="bg-[#121520] p-3.5 rounded-xl border border-[#1e2333] hover:border-purple-500/40 transition group">
                    <div className="text-purple-400 font-bold flex items-center space-x-2 mb-1">
                      <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Modelo C4 + 19 Vistas</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      C4 Niveles 1-4, Secuencia, DFD, Call Graph, Herencia y ER generados.
                    </p>
                  </div>

                  <div className="bg-[#121520] p-3.5 rounded-xl border border-[#1e2333] hover:border-emerald-500/40 transition group">
                    <div className="text-emerald-400 font-bold flex items-center space-x-2 mb-1">
                      <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Fitness Functions</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">
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
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
              <p>Pestaña Activa: <span className="font-bold text-cyan-400 uppercase">{activeMainTab}</span></p>
              <p className="text-xs text-gray-500 mt-1">Conecte el componente de renderizado correspondiente.</p>
            </div>
          )}
        </main>

        {/* Panel Derecho (Inspector de Detalles) */}
        <Rightbar />
      </div>

      {/* Panel Inferior (Output/Logs/Consola) */}
      <Downbar />

      {/* Barra de Estado (Status Bar) */}
      <StatusBar />
    </div>
  );
};
