import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';

interface TreemapViewProps {
  diagramData: C4DiagramData;
}

export const TreemapView: React.FC<TreemapViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];

  if (modules.length === 0) {
    return <div className="p-4 text-center text-slate-400">Sin datos de módulos para el Treemap.</div>;
  }

  const totalLoc = modules.reduce((sum, m) => sum + (m.loc || 1), 0);

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-slate-900 text-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-sky-400">Mapa de Carpetas y Módulos (Treemap)</h3>
        <p className="text-xs text-slate-400">
          El área de cada celda es proporcional a sus Líneas de Código (LOC). El color representa la salud arquitectónica (Verde: Alta mantenibilidad, Rojo: Complejo/Inestable).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-2 border border-slate-700 rounded-lg bg-slate-950 flex-1 min-h-[400px]">
        {modules.map((m) => {
          const pct = Math.max(8, Math.min(100, ((m.loc || 1) / totalLoc) * 100 * 3));
          const maint = m.metrics.maintainabilityIndex || 70;
          
          let bgColor = 'bg-emerald-950/80 border-emerald-600/50 text-emerald-200';
          if (maint < 50) {
            bgColor = 'bg-rose-950/80 border-rose-600/50 text-rose-200';
          } else if (maint < 70) {
            bgColor = 'bg-amber-950/80 border-amber-600/50 text-amber-200';
          }

          return (
            <div
              key={m.id}
              style={{ flexGrow: Math.max(1, Math.round(pct)), minWidth: '120px', minHeight: '80px' }}
              className={`p-3 rounded border flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer ${bgColor}`}
            >
              <div className="font-semibold text-xs truncate" title={m.id}>
                {m.name}
              </div>
              <div className="text-[10px] space-y-0.5 opacity-90">
                <div>LOC: {m.loc}</div>
                <div>Mantenibilidad: {maint.toFixed(1)}</div>
                <div>Comp. Máx: {m.metrics.cyclomaticComplexityMax}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
