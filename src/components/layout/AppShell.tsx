import React from 'react';
import { TopBar } from './TopBar';
import { Leftbar } from './Leftbar';
import { Rightbar } from './Rightbar';
import { Downbar } from './Downbar';
import { StatusBar } from './StatusBar';
import { BreadcrumbBar } from './BreadcrumbBar';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { FolderOpen, Sparkles, LayoutDashboard, Layers, Terminal } from 'lucide-react';

interface AppShellProps {
  onOpenProject: () => void;
  onAnalyzeProject: () => void;
  onCancelAnalysis: () => void;
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  onOpenProject,
  onAnalyzeProject,
  onCancelAnalysis,
  children,
}) => {
  const { activeMainTab } = useUiStore();
  const { amg } = useProjectStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0d13] text-gray-100 font-sans overflow-hidden select-none">
      {/* TopBar Header */}
      <TopBar
        onOpenProject={onOpenProject}
        onAnalyzeProject={onAnalyzeProject}
        onCancelAnalysis={onCancelAnalysis}
      />

      {/* Breadcrumb Bar para navegación C4 */}
      <BreadcrumbBar />

      {/* Región Central: Leftbar + Main Canvas + Rightbar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Panel Izquierdo (Explorador / Jerarquía) */}
        <Leftbar />

        {/* ÁREA CENTRAL MAIN CANVAS */}
        <main className="flex-1 flex flex-col bg-[#0f1118] overflow-hidden relative">
          {children ? (
            children
          ) : !amg ? (
            /* Vista de bienvenida cuando no hay proyecto */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 p-0.5 shadow-xl shadow-blue-500/20 animate-pulse">
                <div className="w-full h-full bg-[#0d0f16] rounded-[14px] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
              </div>

              <div className="max-w-md space-y-2">
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                  Sistema de Análisis de Arquitectura de Código
                </h1>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Analice proyectos multi-lenguaje (TypeScript, Python, Java, Go, Rust, C#, Kotlin, Swift) en 4 niveles C4 con IA local, detección de antipatrones y métricas avanzadas.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={onOpenProject}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Abrir Carpeta de Proyecto</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-xl w-full pt-8 text-left text-xs">
                <div className="bg-[#141724] p-3 rounded-lg border border-[#232838]">
                  <div className="text-cyan-400 font-semibold flex items-center space-x-1.5 mb-1">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard AMG</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Inspeccione acoplamiento, cohesión, e inestabilidad del proyecto.
                  </p>
                </div>

                <div className="bg-[#141724] p-3 rounded-lg border border-[#232838]">
                  <div className="text-purple-400 font-semibold flex items-center space-x-1.5 mb-1">
                    <Layers className="w-4 h-4" />
                    <span>19 Diagramas</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    C4 Niveles 1-4, Secuencia, DFD, Call Graph, Herencia y ER.
                  </p>
                </div>

                <div className="bg-[#141724] p-3 rounded-lg border border-[#232838]">
                  <div className="text-emerald-400 font-semibold flex items-center space-x-1.5 mb-1">
                    <Terminal className="w-4 h-4" />
                    <span>Consola SAAC</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Ejecute comandos internos `saac&gt; ` y consulte la IA local.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
              <p>Pestaña Activa: <span className="font-bold text-blue-400 uppercase">{activeMainTab}</span></p>
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
