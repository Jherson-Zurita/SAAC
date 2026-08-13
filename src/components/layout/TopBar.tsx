import React, { useState } from 'react';
import {
  FolderOpen,
  Play,
  RotateCw,
  Sparkles,
  Sun,
  Moon,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Shield,
  Users,
  ChevronDown,
  XCircle,
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
    downbarOpen,
    toggleLeftbar,
    toggleRightbar,
    toggleDownbar,
    activeMainTab,
    setActiveMainTab,
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

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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
    <header className="h-[48px] bg-[#0B0D10] border-b border-[#252B34] flex items-center justify-between px-3 select-none z-30 font-sans text-xs">
      {/* Brand & Menu Links */}
      <div className="flex items-center space-x-4">
        {/* Brand Badge */}
        <div className="flex items-center space-x-2 mr-2">
          <div className="w-6 h-6 rounded bg-[#211E39] border border-[#302C51] flex items-center justify-center text-[#8B7CFF] font-bold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#8B7CFF]" />
          </div>
          <span className="font-bold text-[13px] tracking-tight text-[#E6E9ED]">
            SAAC <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#211E39] text-[#8B7CFF] border border-[#302C51] ml-1">v2.0</span>
          </span>
        </div>

        {/* IDE Top Menu Items (GraphForge Specification Section 10) */}
        <nav className="hidden md:flex items-center space-x-1 font-medium text-[11px] text-[#858C98]">
          <button
            type="button"
            onClick={onOpenProject}
            className="px-2 py-1 rounded hover:bg-[#171B21] hover:text-[#E6E9ED] transition"
          >
            Archivo
          </button>

          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
            className="px-2 py-1 rounded hover:bg-[#171B21] hover:text-[#E6E9ED] transition"
          >
            Vista
          </button>

          <button
            type="button"
            onClick={onAnalyzeProject}
            disabled={!projectPath || isAnalyzing}
            className="px-2 py-1 rounded hover:bg-[#171B21] hover:text-[#E6E9ED] transition disabled:opacity-40"
          >
            Analizar
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('dashboard')}
            className="px-2 py-1 rounded hover:bg-[#171B21] hover:text-[#E6E9ED] transition"
          >
            Grafos
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('metrics')}
            className="px-2 py-1 rounded hover:bg-[#171B21] hover:text-[#E6E9ED] transition"
          >
            Métricas
          </button>
        </nav>
      </div>

      {/* Center: Quick Project Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenProject}
          disabled={isAnalyzing}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium text-[#E6E9ED] bg-[#13171D] hover:bg-[#171C23] border border-[#252B34] rounded transition disabled:opacity-40"
          title="Abrir directorio de proyecto (Ctrl+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#45C8DF]" />
          <span>Abrir Proyecto</span>
        </button>

        <button
          onClick={onAnalyzeProject}
          disabled={!projectPath || isAnalyzing}
          className="flex items-center space-x-1.5 px-3 py-1 text-[11px] font-semibold bg-[#211E39] hover:bg-[#2c284e] text-[#8B7CFF] border border-[#302C51] rounded transition disabled:opacity-40"
          title={amg ? 'Volver a analizar código AST del proyecto' : 'Iniciar análisis sintáctico AST'}
        >
          {amg ? (
            <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isAnalyzing ? 'Analizando...' : amg ? 'Reanalizar' : 'Analizar'}</span>
        </button>

        {amg && (
          <div className="relative">
            <select
              value={activeDiagramValue}
              onChange={(e) => handleDiagramSelect(e.target.value)}
              className="bg-[#13171D] text-[#E6E9ED] text-[11px] pl-2.5 pr-7 py-1 rounded border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] cursor-pointer appearance-none font-mono"
            >
              <optgroup label="C4 Core">
                <option value="c4:1">C4 N1 — Contexto</option>
                <option value="c4:2">C4 N2 — Contenedores</option>
                <option value="c4:3">C4 N3 — Componentes</option>
                {codeDiagramData && <option value="c4:4">C4 N4 — Código UML</option>}
              </optgroup>
              <optgroup label="Diagramas Suplementarios">
                {supplementaryDiagramDefinitions.map((item) => (
                  <option key={item.tab} value={`supplementary:${item.tab}`}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3 h-3 text-[#858C98] absolute right-2 top-2 pointer-events-none" />
          </div>
        )}

        {onCloseProject && amg && (
          <button
            onClick={onCloseProject}
            className="p-1 text-[#858C98] hover:text-[#EF6B73] rounded hover:bg-[#171B21] transition"
            title="Cerrar proyecto actual"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right Controls: Perspectives, Theme & Layout Panels */}
      <div className="flex items-center space-x-1.5">
        {/* Perspectivas */}
        {amg && (
          <div className="flex items-center space-x-1 mr-2 border-r border-[#252B34] pr-2">
            <button
              onClick={toggleSecurityPerspective}
              className={`p-1.5 rounded transition ${
                securityPerspective
                  ? 'bg-[#211E39] text-[#EF6B73] border border-[#EF6B73]/40'
                  : 'text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21]'
              }`}
              title="Perspectiva de Seguridad"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleOwnershipPerspective}
              className={`p-1.5 rounded transition ${
                ownershipPerspective
                  ? 'bg-[#211E39] text-[#45C8DF] border border-[#45C8DF]/40'
                  : 'text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21]'
              }`}
              title="Perspectiva de Autoría / Ownership"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Layout Panel Toggles */}
        <button
          onClick={toggleLeftbar}
          className={`p-1.5 rounded transition ${
            leftbarOpen ? 'text-[#8B7CFF] bg-[#211E39]' : 'text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21]'
          }`}
          title="Alternar Explorador"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleDownbar}
          className={`p-1.5 rounded transition ${
            downbarOpen ? 'text-[#8B7CFF] bg-[#211E39]' : 'text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21]'
          }`}
          title="Alternar Panel Inferior"
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleRightbar}
          className={`p-1.5 rounded transition ${
            rightbarOpen ? 'text-[#8B7CFF] bg-[#211E39]' : 'text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21]'
          }`}
          title="Alternar Inspector"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21] rounded transition ml-1"
          title={`Tema actual: ${theme}`}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
