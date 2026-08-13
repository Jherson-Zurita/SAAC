import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Folder } from 'lucide-react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';

interface FileTreeViewProps {
  diagramData: C4DiagramData;
}

export const FileTreeView: React.FC<FileTreeViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  // Agrupar módulos por carpeta
  const dirMap = new Map<string, typeof modules>();
  for (const m of modules) {
    const parts = m.id.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push(m);
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-slate-900 text-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-sky-400">Árbol Jerárquico de Directorios y Archivos</h3>
        <p className="text-xs text-slate-400">
          Estructura física del repositorio con badges de Lenguaje, LOC, Complejidad Ciclomática e Índice de Mantenibilidad.
        </p>
      </div>

      <div className="border border-slate-700 rounded-lg p-3 bg-slate-950 flex-1 overflow-auto space-y-2">
        {Array.from(dirMap.entries()).map(([dirPath, dirModules]) => {
          const isCollapsed = collapsedDirs[dirPath];
          return (
            <div key={dirPath} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleDir(dirPath)}
                className="flex items-center gap-2 text-xs font-semibold text-sky-300 hover:text-sky-200 w-full text-left p-1 rounded hover:bg-slate-800/60"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <Folder className="w-4 h-4 text-sky-400" />
                <span>{dirPath}</span>
                <span className="text-[10px] text-slate-400 font-normal">({dirModules.length} archivos)</span>
              </button>

              {!isCollapsed && (
                <div className="ml-6 space-y-1 border-l border-slate-800 pl-3">
                  {dirModules.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/40 text-xs border border-transparent hover:border-slate-700/50"
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <FileCode className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-200">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {m.language}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="text-slate-400">LOC: {m.loc}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            m.metrics.cyclomaticComplexityMax > 15
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          CC Máx: {m.metrics.cyclomaticComplexityMax}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            m.metrics.maintainabilityIndex < 60
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          Maint: {m.metrics.maintainabilityIndex.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
