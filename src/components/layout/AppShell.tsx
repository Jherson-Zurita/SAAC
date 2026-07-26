import React from 'react';
import { TopBar } from './TopBar';
import { Leftbar } from './Leftbar';
import { Rightbar } from './Rightbar';
import { Downbar } from './Downbar';
import { StatusBar } from './StatusBar';
import { BreadcrumbBar } from './BreadcrumbBar';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { FolderOpen, Sparkles, LayoutDashboard, Layers, ShieldCheck } from 'lucide-react';

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
    <div className="h-screen w-screen flex flex-col bg-[#090b10] text-gray-100 font-sans overflow-hidden select-none">
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
        <main className="flex-1 flex flex-col bg-[#0d0f17] overflow-hidden relative">
          {children ? (
            children
          ) : !amg ? (
            /* Vista de bienvenida cuando no hay proyecto */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-y-auto">
              {/* Radial backdrop glow */}
              <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl space-y-6 flex flex-col items-center">
                {/* Hero Badge */}
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plataforma de Auditoría &amp; Arquitectura Multilenguaje</span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                    Sistema de Análisis de Arquitectura de Código
                  </h1>
                  <p className="text-sm text-gray-400 max-w-lg leading-relaxed font-normal">
                    Motor de análisis estático AST para 8 lenguajes (TypeScript, Python, Java, Go, Rust, C#, Kotlin, Swift). Modelo C4 interactivo, Fitness Functions e IA local integrada.
                  </p>
                </div>

                {/* Primary CTA */}
                <div className="pt-2">
                  <button
                    onClick={onOpenProject}
                    className="flex items-center space-x-2.5 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Seleccionar Carpeta de Proyecto</span>
                  </button>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-3 gap-4 w-full pt-8 text-left text-xs">
                  <div className="bg-[#121520] p-4 rounded-xl border border-[#1e2333] hover:border-blue-500/40 transition group">
                    <div className="text-cyan-400 font-bold flex items-center space-x-2 mb-1.5">
                      <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Dashboard &amp; Métricas</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal">
                      Acoplamiento ($Ca, Ce$), instabilidad ($I$), abstractness ($A$) y distancia a la secuencia principal ($D$).
                    </p>
                  </div>

                  <div className="bg-[#121520] p-4 rounded-xl border border-[#1e2333] hover:border-purple-500/40 transition group">
                    <div className="text-purple-400 font-bold flex items-center space-x-2 mb-1.5">
                      <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Modelo C4 + 19 Vistas</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal">
                      C4 Niveles 1-4, Secuencia, DFD, Call Graph, Herencia y ER generados dinámicamente.
                    </p>
                  </div>

                  <div className="bg-[#121520] p-4 rounded-xl border border-[#1e2333] hover:border-emerald-500/40 transition group">
                    <div className="text-emerald-400 font-bold flex items-center space-x-2 mb-1.5">
                      <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Fitness Functions</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal">
                      Evaluación configurable de reglas de arquitectura con cálculo de Fitness Score (0-100).
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
