import React from 'react';
import {
  FolderOpen,
  Play,
  Square,
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  FileText,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Sun,
  Moon,
  Sparkles,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { useUiStore, MainTab } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useDiagramStore } from '../../stores/useDiagramStore';

interface TopBarProps {
  onOpenProject: () => void;
  onAnalyzeProject: () => void;
  onCancelAnalysis: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenProject,
  onAnalyzeProject,
  onCancelAnalysis,
}) => {
  const {
    theme,
    toggleTheme,
    leftbarOpen,
    rightbarOpen,
    downbarOpen,
    toggleLeftbar,
    toggleRightbar,
    toggleDownbar,
    activeMainTab,
    setActiveMainTab,
    setActiveDownbarTab,
    setDownbarOpen,
  } = useUiStore();

  const { projectPath, isAnalyzing } = useProjectStore();
  const { c4Level, setC4Level } = useDiagramStore();

  const handleTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
    if (tab === 'c4' && c4Level > 2) {
      setC4Level(1);
    }
  };

  const handleC4LevelSelect = (level: 1 | 2 | 3) => {
    setActiveMainTab('c4');
    setC4Level(level);
  };

  return (
    <header className="h-12 bg-[#0e111a]/95 backdrop-blur-md border-b border-[#1e2333] flex items-center justify-between px-3 select-none z-30 shadow-md">
      {/* Izquierda: Logo & Acciones Rápidas */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 mr-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 p-0.5 shadow-md shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0d0f17] rounded-[6px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">
            SAAC <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 ml-1">v2.0</span>
          </span>
        </div>

        {/* Botones de Acción de Proyecto */}
        <div className="flex items-center space-x-1.5 border-l border-[#1e2333] pl-3">
          <button
            onClick={onOpenProject}
            disabled={isAnalyzing}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#161a26] hover:bg-[#1f2638] border border-[#252c40] rounded-md transition shadow-sm disabled:opacity-40"
            title="Abrir directorio de proyecto (Ctrl+O)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Abrir...</span>
          </button>

          <button
            onClick={onAnalyzeProject}
            disabled={!projectPath || isAnalyzing}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-md transition shadow-md shadow-blue-600/20 disabled:opacity-40"
            title="Iniciar análisis sintáctico AST"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isAnalyzing ? 'Analizando...' : 'Analizar'}</span>
          </button>

          {isAnalyzing && (
            <button
              onClick={onCancelAnalysis}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-md transition animate-pulse"
              title="Cancelar análisis activo"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Detener</span>
            </button>
          )}
        </div>
      </div>

      {/* Centro: Navegación de Vistas y Diagramas */}
      <div className="flex items-center space-x-1.5 bg-[#090b10] p-1 rounded-lg border border-[#1c2130]">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
            activeMainTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* C4 Level Navigation Pills */}
        <div className="flex items-center border-l border-r border-[#1e2333] px-1 space-x-1">
          <button
            onClick={() => handleC4LevelSelect(1)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              activeMainTab === 'c4' && c4Level === 1
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 1: Contexto del Sistema"
          >
            C4 N1
          </button>
          <button
            onClick={() => handleC4LevelSelect(2)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              activeMainTab === 'c4' && c4Level === 2
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 2: Contenedores"
          >
            C4 N2
          </button>
          <button
            onClick={() => handleC4LevelSelect(3)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              activeMainTab === 'c4' && c4Level === 3
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 3: Componentes"
          >
            C4 N3
          </button>
        </div>

        {/* Dropdown de Diagramas Suplementarios */}
        <div className="relative inline-block">
          <select
            value={['package', 'inheritance', 'er', 'callgraph', 'sequence', 'dynamic', 'dfd'].includes(activeMainTab) ? activeMainTab : ''}
            onChange={(e) => e.target.value && handleTabChange(e.target.value as MainTab)}
            className="bg-[#121520] text-xs font-semibold text-gray-200 border border-[#232a3e] rounded-md px-2.5 py-1 pr-6 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
          >
            <option value="" disabled>📐 Diagramas Suplementarios...</option>
            <option value="package">📦 Paquetes</option>
            <option value="inheritance">🌳 Árbol de Herencia</option>
            <option value="er">🗄️ Entidad-Relación (ER)</option>
            <option value="callgraph">📞 Grafo de Llamadas (Call Graph)</option>
            <option value="sequence">⏱️ Diagrama de Secuencia</option>
            <option value="dynamic">⚡ Diagrama Dinámico C4</option>
            <option value="dfd">🔄 Flujo de Datos (DFD)</option>
          </select>
          <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-2 pointer-events-none" />
        </div>

        {/* Tablas & Informes */}
        <button
          onClick={() => handleTabChange('metrics')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            activeMainTab === 'metrics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Panel de Métricas Arquitectónicas"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Métricas</span>
        </button>

        <button
          onClick={() => handleTabChange('antipatterns')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            activeMainTab === 'antipatterns'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Antipatrones Detectados"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Antipatrones</span>
        </button>

        <button
          onClick={() => handleTabChange('adrs')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            activeMainTab === 'adrs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Registro de Decisiones (ADRs)"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>ADRs</span>
        </button>
      </div>

      {/* Derecha: Paneles & Tema */}
      <div className="flex items-center space-x-1 border-l border-[#1e2333] pl-3">
        <button
          onClick={() => {
            setDownbarOpen(true);
            setActiveDownbarTab('console');
          }}
          className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-[#191f2e] rounded-md transition"
          title="Abrir Consola SAAC (saac> )"
        >
          <Terminal className="w-4 h-4" />
        </button>

        <button
          onClick={toggleLeftbar}
          className={`p-1.5 rounded-md transition ${
            leftbarOpen ? 'text-blue-400 bg-[#1f2638]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#191f2e]'
          }`}
          title="Alternar Panel Izquierdo (Explorador)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={toggleDownbar}
          className={`p-1.5 rounded-md transition ${
            downbarOpen ? 'text-blue-400 bg-[#1f2638]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#191f2e]'
          }`}
          title="Alternar Panel Inferior (Output/Logs)"
        >
          <PanelBottom className="w-4 h-4" />
        </button>

        <button
          onClick={toggleRightbar}
          className={`p-1.5 rounded-md transition ${
            rightbarOpen ? 'text-blue-400 bg-[#1f2638]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#191f2e]'
          }`}
          title="Alternar Panel Derecho (Inspección)"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-[#191f2e] rounded-md transition border-l border-[#1e2333] ml-1"
          title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
