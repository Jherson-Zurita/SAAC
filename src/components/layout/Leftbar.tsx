import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  Compass,
  Search,
  ChevronRight,
  ChevronDown,
  FileCode,
  Box,
  Layers,
  Sparkles,
  Folder,
  FolderOpen,
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  History,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useUiStore, type MainTab } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import type { Module } from '../../../shared/types';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  module?: Module;
  children: Record<string, TreeNode>;
}

export const Leftbar: React.FC = () => {
  const {
    activeLeftbarTab,
    setActiveLeftbarTab,
    leftbarOpen,
    activeMainTab,
    setActiveMainTab,
  } = useUiStore();
  const { amg, projectName } = useProjectStore();
  const { selectElement, selectedId } = useSelectionStore();
  const { setC4Level } = useDiagramStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ root: true });

  const toggleExpand = (nodePath: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodePath]: !prev[nodePath] }));
  };

  // Construir árbol jerárquico de archivos desde amg.modules
  const fileTree = useMemo(() => {
    if (!amg) return null;

    const root: TreeNode = {
      name: projectName || 'Proyecto',
      path: 'root',
      isFolder: true,
      children: {},
    };

    amg.modules.forEach((mod) => {
      const parts = mod.id.split(/[/\\]/).filter(Boolean);
      let current = root;

      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        const currentPath = parts.slice(0, idx + 1).join('/');

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            module: isLast ? mod : undefined,
            children: {},
          };
        }
        current = current.children[part];
      });
    });

    return root;
  }, [amg, projectName]);

  // Filtrar módulos si hay búsqueda
  const filteredModules = useMemo(() => {
    if (!amg) return [];
    if (!searchQuery.trim()) return amg.modules;
    const q = searchQuery.toLowerCase();
    return amg.modules.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [amg, searchQuery]);

  // Renderizador recursivo de nodos del árbol
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes[node.path] ?? depth < 2;

    if (node.isFolder) {
      const childKeys = Object.keys(node.children);
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleExpand(node.path)}
            style={{ paddingLeft: `${depth * 10 + 4}px` }}
            className="flex items-center space-x-1 py-1 px-1 rounded cursor-pointer hover:bg-[#13171D] text-[#858C98] hover:text-[#E6E9ED] transition text-[11px]"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#5F6671] shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#5F6671] shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#E7B85B] shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[#E7B85B] shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {isExpanded && (
            <div>
              {childKeys.map((key) => renderTreeNode(node.children[key], depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Nodo hoja: Módulo/Archivo
    const mod = node.module;
    if (!mod) return null;

    const isSelected = selectedId === mod.id;
    const mi = mod.metrics.maintainabilityIndex;
    const miColor =
      mi >= 80 ? '#4FD49A' : mi >= 60 ? '#E7B85B' : '#EF6B73';

    return (
      <div
        key={mod.id}
        onClick={() => selectElement(mod.id, 'module', mod)}
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
        className={`flex items-center justify-between py-1 px-1 rounded cursor-pointer transition text-[11px] ${
          isSelected
            ? 'bg-[#211E39] text-[#8B7CFF] font-semibold border border-[#302C51]'
            : 'hover:bg-[#13171D] text-[#858C98] hover:text-[#E6E9ED]'
        }`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          <FileCode className="w-3.5 h-3.5 text-[#45C8DF] shrink-0" />
          <span className="truncate">{mod.name}</span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          <span
            className="text-[8px] font-mono px-1 py-0.2 rounded font-bold"
            style={{ color: miColor, backgroundColor: `${miColor}15`, border: `1px solid ${miColor}30` }}
          >
            {Math.round(mi)}
          </span>
        </div>
      </div>
    );
  };

  if (!leftbarOpen) return null;

  return (
    <div className="flex h-full select-none z-10 font-sans text-xs">
      {/* 1. ACTIVITY BAR (GraphForge Spec Section 11 — 46px Width) */}
      <aside className="w-[46px] bg-[#101318] border-r border-[#252B34] flex flex-col justify-between items-center py-2 shrink-0">
        <div className="flex flex-col items-center space-y-3 w-full">
          {/* Activity Bar Items */}
          <button
            onClick={() => setActiveLeftbarTab('explorer')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeLeftbarTab === 'explorer'
                ? 'text-[#E6E9ED]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Explorador de Archivos"
          >
            {activeLeftbarTab === 'explorer' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#8B7CFF] rounded-r" />
            )}
            <FolderTree className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveLeftbarTab('navigation')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeLeftbarTab === 'navigation'
                ? 'text-[#E6E9ED]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Navegación C4 por Jerarquía"
          >
            {activeLeftbarTab === 'navigation' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#8B7CFF] rounded-r" />
            )}
            <Compass className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveLeftbarTab('search')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeLeftbarTab === 'search'
                ? 'text-[#E6E9ED]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Búsqueda Rápida"
          >
            {activeLeftbarTab === 'search' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#8B7CFF] rounded-r" />
            )}
            <Search className="w-4 h-4" />
          </button>

          <div className="w-6 border-b border-[#252B34] my-1" />

          <button
            onClick={() => setActiveMainTab('dashboard')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeMainTab === 'dashboard'
                ? 'text-[#8B7CFF]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveMainTab('metrics')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeMainTab === 'metrics'
                ? 'text-[#8B7CFF]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Métricas de Arquitectura"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveMainTab('antipatterns')}
            className={`relative w-full py-2 flex items-center justify-center transition ${
              activeMainTab === 'antipatterns'
                ? 'text-[#EF6B73]'
                : 'text-[#858C98] hover:text-[#E6E9ED]'
            }`}
            title="Antipatrones"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>

        {/* Activity Bar Bottom Controls */}
        <div className="flex flex-col items-center space-y-2 text-[#858C98]">
          <button className="p-2 hover:text-[#E6E9ED] transition" title="Ayuda & Documentación">
            <HelpCircle className="w-4 h-4" />
          </button>
          <button className="p-2 hover:text-[#E6E9ED] transition" title="Configuración de SAAC">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. EXPLORER PANEL (GraphForge Spec Section 12 — 218px Width) */}
      <aside className="w-[218px] bg-[#101318] border-r border-[#252B34] flex flex-col h-full shrink-0">
        {/* Panel Title */}
        <div className="px-3 py-2 border-b border-[#252B34] bg-[#0B0D10] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#858C98]">
            {activeLeftbarTab === 'explorer'
              ? 'Explorador'
              : activeLeftbarTab === 'navigation'
                ? 'Jerarquía C4'
                : 'Buscar'}
          </span>
          <span className="text-[9px] font-mono text-[#5F6671]">
            {amg ? `${amg.modules.length} mód` : '0'}
          </span>
        </div>

        {/* Filter Input */}
        <div className="p-2 border-b border-[#252B34]">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[#5F6671]" />
            <input
              type="text"
              placeholder="Filtrar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0B0D10] text-[11px] text-[#E6E9ED] pl-7 pr-2 py-1 rounded border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] font-sans placeholder-[#5F6671]"
            />
          </div>
        </div>

        {/* Explorer Content */}
        <div className="flex-1 overflow-y-auto p-1.5 text-[11px]">
          {!amg ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-[#5F6671] space-y-2">
              <FolderTree className="w-7 h-7 opacity-30 text-[#8B7CFF]" />
              <p className="font-medium text-[#858C98]">Sin proyecto cargado</p>
              <p className="text-[10px] text-[#5F6671]">Abra una carpeta para explorar.</p>
            </div>
          ) : (
            <>
              {activeLeftbarTab === 'explorer' && fileTree && (
                <div className="space-y-0.5">{renderTreeNode(fileTree, 0)}</div>
              )}

              {activeLeftbarTab === 'navigation' && (
                <div className="space-y-1.5">
                  <div
                    onClick={() => setC4Level(1)}
                    className="p-2 rounded bg-[#13171D] hover:bg-[#171C23] cursor-pointer border border-[#1D222A] transition"
                  >
                    <div className="flex items-center space-x-1.5 text-[#45C8DF] font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Nivel 1: Contexto</span>
                    </div>
                    <p className="text-[10px] text-[#858C98] mt-0.5 font-mono">
                      {amg.externalSystems.length} ext | {amg.actors.length} actores
                    </p>
                  </div>

                  <div
                    onClick={() => setC4Level(2)}
                    className="p-2 rounded bg-[#13171D] hover:bg-[#171C23] cursor-pointer border border-[#1D222A] transition"
                  >
                    <div className="flex items-center space-x-1.5 text-[#8B7CFF] font-bold text-[11px]">
                      <Box className="w-3.5 h-3.5" />
                      <span>Nivel 2: Contenedores</span>
                    </div>
                    <p className="text-[10px] text-[#858C98] mt-0.5 font-mono">
                      {amg.containers.length} unidades desplegables
                    </p>
                  </div>

                  <div
                    onClick={() => setC4Level(3)}
                    className="p-2 rounded bg-[#13171D] hover:bg-[#171C23] cursor-pointer border border-[#1D222A] transition"
                  >
                    <div className="flex items-center space-x-1.5 text-[#4FD49A] font-bold text-[11px]">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Nivel 3: Componentes</span>
                    </div>
                    <p className="text-[10px] text-[#858C98] mt-0.5 font-mono">
                      {amg.modules.length} módulos
                    </p>
                  </div>
                </div>
              )}

              {activeLeftbarTab === 'search' && (
                <div className="space-y-1">
                  <p className="text-[#5F6671] text-[10px] font-mono mb-1">
                    {filteredModules.length} coincidencias
                  </p>
                  {filteredModules.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => selectElement(m.id, 'module', m)}
                      className="p-1.5 rounded bg-[#13171D] hover:bg-[#171C23] cursor-pointer text-[#E6E9ED] border border-[#1D222A] transition"
                    >
                      <div className="font-semibold text-[#45C8DF] text-[11px]">{m.name}</div>
                      <div className="text-[9px] text-[#5F6671] truncate font-mono">{m.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
