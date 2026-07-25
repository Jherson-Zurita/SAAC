import React, { useState } from 'react';
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
} from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useDiagramStore } from '../../stores/useDiagramStore';

export const Leftbar: React.FC = () => {
  const { activeLeftbarTab, setActiveLeftbarTab, leftbarOpen } = useUiStore();
  const { amg, projectName } = useProjectStore();
  const { selectElement, selectedId } = useSelectionStore();
  const { setC4Level } = useDiagramStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ root: true });

  if (!leftbarOpen) return null;

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  // Filtrar módulos si hay búsqueda
  const filteredModules = amg
    ? amg.modules.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <aside className="w-64 bg-[#12151e] border-r border-[#232838] flex flex-col h-full select-none">
      {/* Pestañas de Leftbar */}
      <div className="flex items-center border-b border-[#232838] bg-[#0d0f16]">
        <button
          onClick={() => setActiveLeftbarTab('explorer')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-medium border-b-2 transition ${
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
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-medium border-b-2 transition ${
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
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 text-xs font-medium border-b-2 transition ${
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
      <div className="p-2 border-b border-[#1f2433]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Filtrar módulos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#090a0f] text-xs text-gray-200 pl-8 pr-2 py-1.5 rounded border border-[#232838] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Contenido según la pestaña activa */}
      <div className="flex-1 overflow-y-auto p-2 text-xs">
        {!amg ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500 space-y-2">
            <FolderTree className="w-8 h-8 opacity-40 text-blue-400" />
            <p>No hay ningún proyecto cargado.</p>
            <p className="text-[11px] text-gray-600">Use el botón 'Abrir...' en la barra superior.</p>
          </div>
        ) : (
          <>
            {/* Pestaña Explorer: Lista de Módulos con métricas visuales */}
            {activeLeftbarTab === 'explorer' && (
              <div className="space-y-1">
                <div
                  onClick={() => toggleFolder('root')}
                  className="flex items-center space-x-1.5 text-gray-300 font-semibold cursor-pointer hover:text-white py-1 px-1 rounded hover:bg-[#1f2433]"
                >
                  {expandedFolders['root'] ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="truncate">{projectName || 'Proyecto'}</span>
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">
                    {amg.modules.length} mod
                  </span>
                </div>

                {expandedFolders['root'] && (
                  <div className="pl-3 space-y-0.5 border-l border-[#1f2433] ml-2">
                    {filteredModules.map((module) => {
                      const isSelected = selectedId === module.id;
                      const mi = module.metrics.maintainabilityIndex;
                      const miColor =
                        mi >= 80 ? 'text-emerald-400' : mi >= 60 ? 'text-amber-400' : 'text-rose-400';

                      return (
                        <div
                          key={module.id}
                          onClick={() => selectElement(module.id, 'module', module)}
                          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-600/30 text-blue-300 font-medium border border-blue-500/40'
                              : 'hover:bg-[#1a1e2c] text-gray-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{module.name}</span>
                          </div>
                          <span className={`text-[10px] font-mono shrink-0 ml-1 ${miColor}`}>
                            MI:{Math.round(mi)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Pestaña Navigation: Jerarquía C4 */}
            {activeLeftbarTab === 'navigation' && (
              <div className="space-y-2">
                <div
                  onClick={() => setC4Level(1)}
                  className="p-2 rounded bg-[#181c28] hover:bg-[#1f2438] cursor-pointer border border-[#262c3e] transition"
                >
                  <div className="flex items-center space-x-2 text-cyan-400 font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>Nivel 1: Contexto</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {amg.externalSystems.length} sistemas ext | {amg.actors.length} actores
                  </p>
                </div>

                <div
                  onClick={() => setC4Level(2)}
                  className="p-2 rounded bg-[#181c28] hover:bg-[#1f2438] cursor-pointer border border-[#262c3e] transition"
                >
                  <div className="flex items-center space-x-2 text-blue-400 font-medium">
                    <Box className="w-4 h-4" />
                    <span>Nivel 2: Contenedores</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {amg.containers.length} unidades desplegables
                  </p>
                </div>

                <div
                  onClick={() => setC4Level(3)}
                  className="p-2 rounded bg-[#181c28] hover:bg-[#1f2438] cursor-pointer border border-[#262c3e] transition"
                >
                  <div className="flex items-center space-x-2 text-purple-400 font-medium">
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
              <div className="space-y-2">
                <p className="text-gray-400 text-[11px]">
                  Buscando coincidentes para "{searchQuery || '...'}"
                </p>
                {filteredModules.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => selectElement(m.id, 'module', m)}
                    className="p-1.5 rounded hover:bg-[#1a1e2c] cursor-pointer text-gray-300"
                  >
                    <div className="font-mono text-cyan-300">{m.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{m.id}</div>
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
