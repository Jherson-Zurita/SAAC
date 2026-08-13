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
  XCircle,
  RotateCw,
  Palette,
  Shield,
  Users,
} from 'lucide-react';
import { useUiStore, type MainTab } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useDiagramStore, type C4Level } from '../../stores/useDiagramStore';
import {
  isSupplementaryDiagramTab,
  supplementaryDiagramDefinitions,
} from '../c4viewer/diagram-registry';

interface TopBarProps {
  onOpenProject: () => void;
  onAnalyzeProject: () => void;
  onCancelAnalysis: () => void;
  onCloseProject?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenProject,
  onAnalyzeProject,
  onCancelAnalysis,
  onCloseProject,
}) => {
  const {
    theme,
    toggleTheme,
    leftbarOpen,
    rightbarOpen,
    activeMainTab,
    setActiveMainTab,
    setActiveDownbarTab,
    setDownbarOpen,
    securityPerspective,
    ownershipPerspective,
    toggleSecurityPerspective,
    toggleOwnershipPerspective,
  } = useUiStore();

  const { projectPath, isAnalyzing, amg } = useProjectStore();
  const {
    c4Level,
    activeContainerId,
    activeModuleId,
    codeDiagramData,
    setC4Level,
  } = useDiagramStore();

  const handleTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
  };

  const handleDiagramSelect = (value: string) => {
    if (value.startsWith('c4:')) {
      const level = Number(value.slice(3)) as C4Level;
      if (level === 4 && !codeDiagramData) return;

      setActiveMainTab('c4');
      if (level === 3) {
        const container =
          amg?.containers.find((item) => item.id === activeContainerId) ||
          amg?.containers.find((item) => Boolean(amg.c4Models.componentDiagrams[item.id]));
        setC4Level(
          3,
          container?.id || null,
          null,
          container ? `Componentes: ${container.name}` : 'Componentes'
        );
      } else if (level === 4) {
        setC4Level(4, activeContainerId, activeModuleId);
      } else {
        setC4Level(level);
      }
      return;
    }

    const tab = value.replace('supplementary:', '') as MainTab;
    if (isSupplementaryDiagramTab(tab)) setActiveMainTab(tab);
  };

  const activeDiagramValue =
    activeMainTab === 'c4'
      ? `c4:${c4Level}`
      : isSupplementaryDiagramTab(activeMainTab)
        ? `supplementary:${activeMainTab}`
        : '';

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
            title={amg ? 'Volver a analizar código AST del proyecto' : 'Iniciar análisis sintáctico AST'}
          >
            {amg ? (
              <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isAnalyzing ? 'Analizando...' : amg ? 'Reanalizar' : 'Analizar'}</span>
          </button>

          {projectPath && !isAnalyzing && onCloseProject && (
            <button
              onClick={onCloseProject}
              className="flex items-center space-x-1 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-rose-400 bg-[#161a26] hover:bg-[#231a20] border border-[#252c40] hover:border-rose-500/30 rounded-md transition"
              title="Cerrar proyecto y volver a la pantalla inicial"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cerrar</span>
            </button>
          )}

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

        {/* Selector unificado: 4 niveles C4 + 8 vistas suplementarias */}
        <div className="relative inline-block border-l border-r border-[#1e2333] px-1">
          <select
            value={activeDiagramValue}
            onChange={(event) => handleDiagramSelect(event.target.value)}
            className="min-w-48 bg-[#121520] text-xs font-semibold text-gray-200 border border-[#232a3e] rounded-md px-2.5 py-1 pr-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 appearance-none cursor-pointer"
            aria-label="Seleccionar diagrama arquitectónico"
          >
            <option value="" disabled>Seleccionar diagrama…</option>
            <optgroup label="Modelo C4">
              <option value="c4:1">C4 N1 · Contexto</option>
              <option value="c4:2">C4 N2 · Contenedores</option>
              <option value="c4:3">C4 N3 · Componentes</option>
              <option value="c4:4" disabled={!codeDiagramData}>
                C4 N4 · Código {codeDiagramData ? '' : '(doble clic en un componente)'}
              </option>
            </optgroup>
            <optgroup label="Diagramas suplementarios">
              {supplementaryDiagramDefinitions.map((definition) => (
                <option
                  key={definition.tab}
                  value={`supplementary:${definition.tab}`}
                >
                  {definition.shortLabel}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-2 pointer-events-none" />
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

        <button
          onClick={() => handleTabChange('design')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            activeMainTab === 'design'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
          }`}
          title="Módulo de Diseño Arquitectónico Interactivo (Canvas Canvas)"
        >
          <Palette className="w-3.5 h-3.5 text-purple-400" />
          <span>Diseño</span>
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
          onClick={toggleSecurityPerspective}
          className={`p-1.5 rounded-md transition ${
            securityPerspective
              ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-500/40'
              : 'text-gray-400 hover:text-emerald-400 hover:bg-[#191f2e]'
          }`}
          title="Perspectiva de Seguridad (Zonas de Red, Cifrado, Autenticación)"
        >
          <Shield className="w-4 h-4" />
        </button>

        <button
          onClick={toggleOwnershipPerspective}
          className={`p-1.5 rounded-md transition ${
            ownershipPerspective
              ? 'text-purple-400 bg-purple-950/80 border border-purple-500/40'
              : 'text-gray-400 hover:text-purple-400 hover:bg-[#191f2e]'
          }`}
          title="Perspectiva de Propiedad (Equipos y Autores por Módulo)"
        >
          <Users className="w-4 h-4" />
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
