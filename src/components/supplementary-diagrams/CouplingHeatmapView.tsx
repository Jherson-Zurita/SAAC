import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';

interface CouplingHeatmapViewProps {
  diagramData: C4DiagramData;
}

export const CouplingHeatmapView: React.FC<CouplingHeatmapViewProps> = ({ diagramData }) => {
  const { amg } = useProjectStore();
  const { selectElement } = useSelectionStore();
  const modules = amg?.modules || [];

  if (modules.length === 0) {
    return <div className="p-4 text-center text-[var(--muted)] font-sans text-xs">Sin datos de módulos para la matriz de acoplamiento.</div>;
  }

  // Mapa de dependencias: source -> target -> peso acumulado (el backend emite el peso como "weight N")
  const depMap = new Map<string, Map<string, number>>();
  let maxWeight = 0;
  for (const edge of diagramData.edges) {
    const parsed = Number(/weight\s+(\d+(?:\.\d+)?)/i.exec(edge.label)?.[1]);
    const weight = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    if (!depMap.has(edge.source)) {
      depMap.set(edge.source, new Map());
    }
    const targets = depMap.get(edge.source)!;
    const total = (targets.get(edge.target) || 0) + weight;
    targets.set(edge.target, total);
    if (edge.source !== edge.target) maxWeight = Math.max(maxWeight, total);
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-200">
      <div className="mb-3 p-3 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--purple)] tracking-tight">
            Mapa de Calor de Acoplamiento (Coupling Matrix)
          </h3>
          <span className="text-[10px] font-mono text-[var(--muted-2)]">
            {modules.length} módulos · Clic en una fila/celda para inspeccionar en el panel derecho
          </span>
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">
          Matriz de adyacencia de dependencias módulo por módulo. Cada celda indica el peso del acoplamiento eferente directo; un rojo más intenso significa más referencias.
        </p>
      </div>

      <div className="overflow-auto border border-[var(--border)] rounded-md bg-[var(--panel)] flex-1">
        <table className="border-collapse text-[11px] w-full">
          <thead>
            <tr className="bg-[var(--panel-2)] border-b border-[var(--border)]">
              <th className="p-2 border-r border-[var(--border)] text-left min-w-[150px] font-semibold text-[var(--muted)]">
                Módulo / Módulo
              </th>
              {modules.map((m) => (
                <th
                  key={m.id}
                  onClick={() => selectElement(m.id, 'module', m)}
                  className="p-2 border-r border-[var(--border)] font-mono text-center truncate max-w-[100px] text-[var(--cyan)] cursor-pointer hover:underline"
                  title={`Ver ${m.name} en inspector`}
                >
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((rowMod) => (
              <tr key={rowMod.id} className="border-b border-[var(--border)] hover:bg-[var(--panel-2)]/60 transition">
                <td
                  onClick={() => selectElement(rowMod.id, 'module', rowMod)}
                  className="p-2 font-mono border-r border-[var(--border)] font-semibold text-[var(--text)] truncate max-w-[180px] cursor-pointer hover:text-[var(--purple)]"
                  title={`Ver ${rowMod.name} en inspector`}
                >
                  {rowMod.name}
                </td>
                {modules.map((colMod) => {
                  const isSelf = rowMod.id === colMod.id;
                  const weight = isSelf ? 0 : depMap.get(rowMod.id)?.get(colMod.id) || 0;
                  const intensity = weight > 0 && maxWeight > 0 ? 0.15 + 0.6 * (weight / maxWeight) : 0;

                  let cellClass = 'bg-[var(--bg)]/40 text-[var(--muted-2)]';
                  if (isSelf) {
                    cellClass = 'bg-[var(--panel-3)] text-[var(--muted-2)]';
                  } else if (weight > 0) {
                    cellClass = 'border border-[#EF6B73]/40 text-[var(--red)] font-bold font-mono hover:brightness-125 cursor-pointer';
                  }

                  return (
                    <td
                      key={colMod.id}
                      onClick={() => selectElement(rowMod.id, 'module', rowMod)}
                      className={`p-2 border-r border-[var(--border)] text-center font-mono ${cellClass}`}
                      style={weight > 0 ? { backgroundColor: `rgba(239, 107, 115, ${intensity.toFixed(2)})` } : undefined}
                      title={weight > 0 ? `${rowMod.name} -> ${colMod.name}: peso ${weight} (Clic para inspeccionar ${rowMod.name})` : ''}
                    >
                      {isSelf ? '-' : weight}
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
