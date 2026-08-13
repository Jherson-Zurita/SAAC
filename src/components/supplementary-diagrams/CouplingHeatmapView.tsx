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
    return <div className="p-4 text-center text-[#858C98] font-sans text-xs">Sin datos de módulos para la matriz de acoplamiento.</div>;
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
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[#0B0E12] text-[#E6E9ED] font-sans">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[#8B7CFF] tracking-tight">Mapa de Calor de Acoplamiento (Coupling Matrix)</h3>
        <p className="text-xs text-[#858C98]">
          Matriz de adyacencia de dependencias módulo por módulo. Celdas más oscuras/rojas indican acoplamiento más fuerte.
        </p>
      </div>

      <div className="overflow-auto border border-[#252B34] rounded-md bg-[#101318]">
        <table className="border-collapse text-[11px] w-full">
          <thead>
            <tr className="bg-[#13171D] border-b border-[#252B34]">
              <th className="p-2 border-r border-[#252B34] text-left min-w-[150px] font-semibold text-[#858C98]">
                Módulo / Módulo
              </th>
              {modules.map((m) => (
                <th key={m.id} className="p-2 border-r border-[#252B34] font-mono text-center truncate max-w-[100px] text-[#45C8DF]" title={m.name}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((rowMod) => (
              <tr key={rowMod.id} className="border-b border-[#252B34] hover:bg-[#13171D]/60 transition">
                <td className="p-2 font-mono border-r border-[#252B34] font-semibold text-[#E6E9ED] truncate max-w-[180px]" title={rowMod.id}>
                  {rowMod.name}
                </td>
                {modules.map((colMod) => {
                  const isSelf = rowMod.id === colMod.id;
                  const hasDep = depMap.get(rowMod.id)?.get(colMod.id) || 0;

                  let cellClass = 'bg-[#0B0E12]/40 text-[#5F6671]';
                  if (isSelf) {
                    cellClass = 'bg-[#171C23] text-[#5F6671]';
                  } else if (hasDep > 0) {
                    cellClass = 'bg-[#EF6B73]/30 border border-[#EF6B73]/50 text-[#EF6B73] font-bold font-mono';
                  }

                  return (
                    <td
                      key={colMod.id}
                      className={`p-2 border-r border-[#252B34] text-center font-mono ${cellClass}`}
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
