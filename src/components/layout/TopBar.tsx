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
    <header className="h-[48px] bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between px-3 select-none z-30 font-sans text-xs transition-colors duration-200">
      {/* Brand & Menu Links */}
      <div className="flex items-center space-x-4">
        {/* Brand Badge */}
        <div className="flex items-center space-x-2 mr-2">
          <div className="w-6 h-6 rounded bg-[var(--purple-soft)] border border-[var(--purple-border)] flex items-center justify-center text-[var(--purple)] font-bold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--purple)]" />
          </div>
          <span className="font-bold text-[13px] tracking-tight text-[var(--text)]">
            SAAC <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--purple-soft)] text-[var(--purple)] border border-[var(--purple-border)] ml-1">v2.0</span>
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
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium text-[var(--text)] bg-[var(--panel-2)] hover:bg-[var(--panel-3)] border border-[var(--border-soft)] rounded transition disabled:opacity-40"
          title="Abrir directorio de proyecto (Ctrl+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[var(--cyan)]" />
          <span>Abrir Proyecto</span>
        </button>

        <button
          onClick={isAnalyzing ? onCancelAnalysis : onAnalyzeProject}
          disabled={!projectPath && !isAnalyzing}
          className={`flex items-center space-x-1.5 px-3 py-1 text-[11px] font-semibold rounded transition ${
            isAnalyzing
              ? 'bg-[var(--red)]/20 hover:bg-[var(--red)]/30 text-[var(--red)] border border-[var(--red)]/40'
              : 'bg-[var(--purple-soft)] hover:bg-[var(--purple)] hover:text-white text-[var(--purple)] border border-[var(--purple-border)] disabled:opacity-40'
          }`}
          title={isAnalyzing ? 'Cancelar análisis en curso' : amg ? 'Volver a analizar código AST del proyecto' : 'Iniciar análisis sintáctico AST'}
        >
          {isAnalyzing ? (
            <>
              <XCircle className="w-3.5 h-3.5 text-[var(--red)]" />
              <span>Cancelar</span>
            </>
          ) : (
            <>
              {amg ? (
                <RotateCw className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{amg ? 'Reanalizar' : 'Analizar'}</span>
            </>
          )}
        </button>

        {amg && (
          <div className="relative">
            <select
              value={activeDiagramValue}
              onChange={(e) => handleDiagramSelect(e.target.value)}
              className="bg-[var(--panel-2)] text-[var(--text)] text-[11px] pl-2.5 pr-7 py-1 rounded border border-[var(--border-soft)] focus:outline-none focus:border-[var(--purple)] cursor-pointer appearance-none font-mono"
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
            <ChevronDown className="w-3 h-3 text-[var(--muted)] absolute right-2 top-2 pointer-events-none" />
          </div>
        )}

        {onCloseProject && amg && (
          <button
            onClick={onCloseProject}
            className="p-1 text-[var(--muted)] hover:text-[var(--red)] rounded hover:bg-[var(--border-soft)] transition"
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
          <div className="flex items-center space-x-1 mr-2 border-r border-[var(--border)] pr-2">
            <button
              onClick={toggleSecurityPerspective}
              className={`p-1.5 rounded transition ${
                securityPerspective
                  ? 'bg-[var(--purple-soft)] text-[var(--red)] border border-[var(--red)]/40'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)]'
              }`}
              title="Perspectiva de Seguridad"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleOwnershipPerspective}
              className={`p-1.5 rounded transition ${
                ownershipPerspective
                  ? 'bg-[var(--purple-soft)] text-[var(--cyan)] border border-[var(--cyan)]/40'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)]'
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
            leftbarOpen ? 'text-[var(--purple)] bg-[var(--purple-soft)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)]'
          }`}
          title="Alternar Explorador"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleDownbar}
          className={`p-1.5 rounded transition ${
            downbarOpen ? 'text-[var(--purple)] bg-[var(--purple-soft)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)]'
          }`}
          title="Alternar Panel Inferior"
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleRightbar}
          className={`p-1.5 rounded transition ${
            rightbarOpen ? 'text-[var(--purple)] bg-[var(--purple-soft)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)]'
          }`}
          title="Alternar Inspector"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)] rounded transition ml-1"
          title={`Tema actual: ${theme}`}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
