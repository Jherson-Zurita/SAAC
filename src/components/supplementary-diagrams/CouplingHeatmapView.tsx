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
    return <div className="p-4 text-center text-[var(--muted)] font-sans text-xs">Sin datos de módulos para la matriz de acoplamiento.</div>;
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
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-200">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--purple)] tracking-tight">Mapa de Calor de Acoplamiento (Coupling Matrix)</h3>
        <p className="text-xs text-[var(--muted)]">
          Matriz de adyacencia de dependencias módulo por módulo. Celdas en rojo señalan acoplamiento eferente directo.
        </p>
      </div>

      <div className="overflow-auto border border-[var(--border)] rounded-md bg-[var(--panel)]">
        <table className="border-collapse text-[11px] w-full">
          <thead>
            <tr className="bg-[var(--panel-2)] border-b border-[var(--border)]">
              <th className="p-2 border-r border-[var(--border)] text-left min-w-[150px] font-semibold text-[var(--muted)]">
                Módulo / Módulo
              </th>
              {modules.map((m) => (
                <th key={m.id} className="p-2 border-r border-[var(--border)] font-mono text-center truncate max-w-[100px] text-[var(--cyan)]" title={m.name}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((rowMod) => (
              <tr key={rowMod.id} className="border-b border-[var(--border)] hover:bg-[var(--panel-2)]/60 transition">
                <td className="p-2 font-mono border-r border-[var(--border)] font-semibold text-[var(--text)] truncate max-w-[180px]" title={rowMod.id}>
                  {rowMod.name}
                </td>
                {modules.map((colMod) => {
                  const isSelf = rowMod.id === colMod.id;
                  const hasDep = depMap.get(rowMod.id)?.get(colMod.id) || 0;

                  let cellClass = 'bg-[var(--bg)]/40 text-[var(--muted-2)]';
                  if (isSelf) {
                    cellClass = 'bg-[var(--panel-3)] text-[var(--muted-2)]';
                  } else if (hasDep > 0) {
                    cellClass = 'bg-[#EF6B73]/20 border border-[#EF6B73]/40 text-[var(--red)] font-bold font-mono';
                  }

                  return (
                    <td
                      key={colMod.id}
                      className={`p-2 border-r border-[var(--border)] text-center font-mono ${cellClass}`}
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
