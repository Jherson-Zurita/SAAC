import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';

interface CouplingHeatmapViewProps {
  diagramData: C4DiagramData;
}

export const CouplingHeatmapView: React.FC<CouplingHeatmapViewProps> = ({ diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];

  if (modules.length === 0) {
    return <div className="p-4 text-center text-slate-400">Sin datos de módulos para la matriz de acoplamiento.</div>;
  }

  // Mapa de dependencias: source -> target -> weight
  const depMap = new Map<string, Map<string, number>>();
  for (const edge of diagramData.edges) {
    if (!depMap.has(edge.source)) {
      depMap.set(edge.source, new Map());
    }
    depMap.get(edge.source)!.set(edge.target, 1);
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-slate-900 text-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-sky-400">Mapa de Calor de Acoplamiento (Coupling Matrix)</h3>
        <p className="text-xs text-slate-400">
          Matriz de adyacencia de dependencias módulo por módulo. Celdas más oscuras/rojas indican acoplamiento más fuerte.
        </p>
      </div>

      <div className="overflow-auto border border-slate-700 rounded-lg">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="p-2 border-r border-slate-700 text-left min-w-[150px]">Módulo / Módulo</th>
              {modules.map((m) => (
                <th key={m.id} className="p-2 border-r border-slate-700 font-mono text-center truncate max-w-[100px]" title={m.name}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((rowMod) => (
              <tr key={rowMod.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-2 font-mono border-r border-slate-700 font-medium truncate max-w-[180px]" title={rowMod.id}>
                  {rowMod.name}
                </td>
                {modules.map((colMod) => {
                  const isSelf = rowMod.id === colMod.id;
                  const hasDep = depMap.get(rowMod.id)?.get(colMod.id) || 0;

                  let cellClass = 'bg-slate-950/40';
                  if (isSelf) {
                    cellClass = 'bg-slate-800/20 text-slate-600';
                  } else if (hasDep > 0) {
                    cellClass = 'bg-rose-600/60 text-white font-bold';
                  }

                  return (
                    <td
                      key={colMod.id}
                      className={`p-2 border-r border-slate-800 text-center font-mono ${cellClass}`}
                      title={hasDep ? `${rowMod.name} -> ${colMod.name}` : ''}
                    >
                      {isSelf ? '-' : hasDep > 0 ? '1' : '0'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
