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
    return <div className="p-4 text-center text-[#858C98] font-sans text-xs">Sin datos de módulos para el Treemap.</div>;
  }

  const totalLoc = modules.reduce((sum, m) => sum + (m.loc || 1), 0);

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[#0B0E12] text-[#E6E9ED] font-sans">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[#8B7CFF] tracking-tight">Mapa de Carpetas y Módulos (Treemap)</h3>
        <p className="text-xs text-[#858C98]">
          El área de cada celda es proporcional a sus Líneas de Código (LOC). El color representa la salud arquitectónica (Verde: Alta mantenibilidad, Rojo: Complejo/Inestable).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-2 border border-[#252B34] rounded-md bg-[#101318] flex-1 min-h-[400px]">
        {modules.map((m) => {
          const pct = Math.max(8, Math.min(100, ((m.loc || 1) / totalLoc) * 100 * 3));
          const maint = m.metrics.maintainabilityIndex || 70;

          let bgColor = 'bg-[#4FD49A]/10 border-[#4FD49A]/30 text-[#4FD49A]';
          if (maint < 50) {
            bgColor = 'bg-[#EF6B73]/15 border-[#EF6B73]/40 text-[#EF6B73]';
          } else if (maint < 70) {
            bgColor = 'bg-[#E7B85B]/15 border-[#E7B85B]/40 text-[#E7B85B]';
          }

          return (
            <div
              key={m.id}
              style={{ flexGrow: Math.max(1, Math.round(pct)), minWidth: '120px', minHeight: '80px' }}
              className={`p-2.5 rounded-md border flex flex-col justify-between transition-transform hover:scale-[1.01] cursor-pointer ${bgColor}`}
            >
              <div className="font-semibold text-xs truncate" title={m.id}>
                {m.name}
              </div>
              <div className="text-[10px] space-y-0.5 opacity-90 font-mono">
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
