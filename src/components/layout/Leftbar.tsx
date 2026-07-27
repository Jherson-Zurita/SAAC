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
} from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
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
  const { activeLeftbarTab, setActiveLeftbarTab, leftbarOpen } = useUiStore();
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
      // Separar por slashes / o \
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
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            className="flex items-center space-x-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-[#161a26] text-gray-300 hover:text-white transition font-medium text-xs"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
    const miBadgeClass =
      mi >= 80
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : mi >= 60
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

    return (
      <div
        key={mod.id}
        onClick={() => selectElement(mod.id, 'module', mod)}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className={`flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition text-xs ${
          isSelected
            ? 'bg-blue-600/30 text-blue-200 font-semibold border border-blue-500/40 shadow-sm'
            : 'hover:bg-[#161a26] text-gray-300 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{mod.name}</span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono text-gray-400 bg-[#1e2333]">
            {mod.language}
          </span>
          <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${miBadgeClass}`}>
            MI:{Math.round(mi)}
          </span>
        </div>
      </div>
    );
  };

  if (!leftbarOpen) return null;

  return (
    <aside className="w-64 bg-[#121520] border-r border-[#1e2333] flex flex-col h-full select-none z-10">
      {/* Header Pestañas Leftbar */}
      <div className="flex items-center border-b border-[#1e2333] bg-[#0d0f17]">
        <button
          onClick={() => setActiveLeftbarTab('explorer')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-semibold border-b-2 transition ${
            activeLeftbarTab === 'explorer'
              ? 'border-blue-500 text-blue-400 bg-[#161a26]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
          title="Explorador de Archivos y Módulos"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Explorador</span>
        </button>

        <button
          onClick={() => setActiveLeftbarTab('navigation')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-semibold border-b-2 transition ${
            activeLeftbarTab === 'navigation'
              ? 'border-blue-500 text-blue-400 bg-[#161a26]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
          title="Navegación C4 por Jerarquía"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Jerarquía</span>
        </button>

        <button
          onClick={() => setActiveLeftbarTab('search')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-semibold border-b-2 transition ${
            activeLeftbarTab === 'search'
              ? 'border-blue-500 text-blue-400 bg-[#161a26]'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
          title="Búsqueda Rápida"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Buscar</span>
        </button>
      </div>

      {/* Input de filtro general */}
      <div className="p-2 border-b border-[#1e2333]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Filtrar módulos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#090b10] text-xs text-gray-200 pl-8 pr-2 py-1.5 rounded border border-[#1e2333] focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
      </div>

      {/* Cuerpo del Leftbar */}
      <div className="flex-1 overflow-y-auto p-2 text-xs">
        {!amg ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500 space-y-2">
            <FolderTree className="w-8 h-8 opacity-40 text-blue-400" />
            <p className="font-medium">Sin proyecto cargado.</p>
            <p className="text-[11px] text-gray-600">Haga clic en 'Abrir...' en la barra superior.</p>
          </div>
        ) : (
          <>
            {/* Pestaña Explorer: Árbol de archivos real */}
            {activeLeftbarTab === 'explorer' && fileTree && (
              <div className="space-y-0.5">
                {renderTreeNode(fileTree, 0)}
              </div>
            )}

            {/* Pestaña Navigation: Jerarquía C4 */}
            {activeLeftbarTab === 'navigation' && (
              <div className="space-y-2">
                <div
                  onClick={() => setC4Level(1)}
                  className="p-2.5 rounded-lg bg-[#161a26] hover:bg-[#1f2638] cursor-pointer border border-[#232a3e] transition"
                >
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Nivel 1: Contexto</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {amg.externalSystems.length} sistemas externos | {amg.actors.length} actores
                  </p>
                </div>

                <div
                  onClick={() => setC4Level(2)}
                  className="p-2.5 rounded-lg bg-[#161a26] hover:bg-[#1f2638] cursor-pointer border border-[#232a3e] transition"
                >
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <Box className="w-4 h-4" />
                    <span>Nivel 2: Contenedores</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {amg.containers.length} unidades desplegables
                  </p>
                </div>

                <div
                  onClick={() => setC4Level(3)}
                  className="p-2.5 rounded-lg bg-[#161a26] hover:bg-[#1f2638] cursor-pointer border border-[#232a3e] transition"
                >
                  <div className="flex items-center space-x-2 text-purple-400 font-bold">
                    <Layers className="w-4 h-4" />
                    <span>Nivel 3: Componentes</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {amg.modules.length} componentes/módulos
                  </p>
                </div>
              </div>
            )}

            {/* Pestaña Search: Búsqueda avanzada */}
            {activeLeftbarTab === 'search' && (
              <div className="space-y-1.5">
                <p className="text-gray-400 text-[11px]">
                  {filteredModules.length} módulos encontrados
                </p>
                {filteredModules.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => selectElement(m.id, 'module', m)}
                    className="p-2 rounded bg-[#161a26] hover:bg-[#1f2638] cursor-pointer text-gray-200 border border-[#232a3e] transition"
                  >
                    <div className="font-bold text-cyan-300">{m.name}</div>
                    <div className="text-[10px] text-gray-500 truncate font-mono">{m.id}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
