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
    <header className="h-12 bg-[#12151e] border-b border-[#232838] flex items-center justify-between px-3 select-none z-20">
      {/* Izquierda: Logo y Menú Principal */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            SAAC <span className="text-xs font-mono text-cyan-400 font-semibold">v2.0</span>
          </span>
        </div>

        {/* Acciones Rápidas de Proyecto */}
        <div className="flex items-center space-x-1 border-l border-[#232838] pl-3">
          <button
            onClick={onOpenProject}
            disabled={isAnalyzing}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white hover:bg-[#1f2433] rounded-md transition disabled:opacity-50"
            title="Abrir directorio de proyecto"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Abrir...</span>
          </button>

          <button
            onClick={onAnalyzeProject}
            disabled={!projectPath || isAnalyzing}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-md transition disabled:opacity-40"
            title="Iniciar análisis sintáctico AST"
          >
            <Play className="w-3.5 h-3.5 fill-blue-400" />
            <span>{isAnalyzing ? 'Analizando...' : 'Analizar'}</span>
          </button>

          {isAnalyzing && (
            <button
              onClick={onCancelAnalysis}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-md transition animate-pulse"
              title="Cancelar análisis en curso"
            >
              <Square className="w-3.5 h-3.5 fill-rose-400" />
              <span>Detener</span>
            </button>
          )}
        </div>
      </div>

      {/* Centro: Selectores de Vista / Diagramas */}
      <div className="flex items-center space-x-1 bg-[#0b0d13] p-1 rounded-lg border border-[#1f2433]">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-md font-medium transition ${
            activeMainTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* C4 Level Selectors */}
        <div className="flex items-center border-l border-r border-[#1f2433] px-1 space-x-0.5">
          <button
            onClick={() => handleC4LevelSelect(1)}
            className={`px-2 py-1 text-xs rounded-md font-medium transition ${
              activeMainTab === 'c4' && c4Level === 1
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 1: Contexto del Sistema"
          >
            C4 N1
          </button>
          <button
            onClick={() => handleC4LevelSelect(2)}
            className={`px-2 py-1 text-xs rounded-md font-medium transition ${
              activeMainTab === 'c4' && c4Level === 2
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 2: Contenedores"
          >
            C4 N2
          </button>
          <button
            onClick={() => handleC4LevelSelect(3)}
            className={`px-2 py-1 text-xs rounded-md font-medium transition ${
              activeMainTab === 'c4' && c4Level === 3
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
            }`}
            title="C4 Nivel 3: Componentes"
          >
            C4 N3
          </button>
        </div>

        {/* Menú de Vistas Suplementarias */}
        <select
          value={['package', 'inheritance', 'er', 'callgraph', 'sequence', 'dynamic', 'dfd'].includes(activeMainTab) ? activeMainTab : ''}
          onChange={(e) => e.target.value && handleTabChange(e.target.value as MainTab)}
          className="bg-[#12151e] text-xs text-gray-300 border border-[#232838] rounded-md px-2 py-1 focus:outline-none focus:border-blue-500 font-medium"
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

        {/* Tablas & Informes */}
        <button
          onClick={() => handleTabChange('metrics')}
          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-md font-medium transition ${
            activeMainTab === 'metrics'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Panel de Métricas Arquitectónicas"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Métricas</span>
        </button>

        <button
          onClick={() => handleTabChange('antipatterns')}
          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-md font-medium transition ${
            activeMainTab === 'antipatterns'
              ? 'bg-amber-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Antipatrones Detectados"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Antipatrones</span>
        </button>

        <button
          onClick={() => handleTabChange('adrs')}
          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-md font-medium transition ${
            activeMainTab === 'adrs'
              ? 'bg-emerald-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Registro de Decisiones (ADRs)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>ADRs</span>
        </button>
      </div>

      {/* Derecha: Toggles de Paneles y Tema */}
      <div className="flex items-center space-x-1 border-l border-[#232838] pl-3">
        <button
          onClick={() => {
            setDownbarOpen(true);
            setActiveDownbarTab('console');
          }}
          className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-[#1f2433] rounded-md transition"
          title="Abrir Consola SAAC (saac> )"
        >
          <Terminal className="w-4 h-4" />
        </button>

        <button
          onClick={toggleLeftbar}
          className={`p-1.5 rounded-md transition ${
            leftbarOpen ? 'text-blue-400 bg-[#1f2433]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2433]'
          }`}
          title="Alternar Panel Izquierdo (Explorador)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={toggleDownbar}
          className={`p-1.5 rounded-md transition ${
            downbarOpen ? 'text-blue-400 bg-[#1f2433]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2433]'
          }`}
          title="Alternar Panel Inferior (Output/Logs)"
        >
          <PanelBottom className="w-4 h-4" />
        </button>

        <button
          onClick={toggleRightbar}
          className={`p-1.5 rounded-md transition ${
            rightbarOpen ? 'text-blue-400 bg-[#1f2433]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2433]'
          }`}
          title="Alternar Panel Derecho (Inspección)"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-[#1f2433] rounded-md transition border-l border-[#232838] ml-1"
          title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
