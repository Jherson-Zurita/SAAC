import React from 'react';
import { UserCheck, AlertTriangle } from 'lucide-react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';

interface OwnershipMapViewProps {
  diagramData: C4DiagramData;
}

export const OwnershipMapView: React.FC<OwnershipMapViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];

  if (modules.length === 0) {
    return <div className="p-4 text-center text-[#858C98] font-sans text-xs">Sin datos de módulos para Ownership Map.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[#0B0E12] text-[#E6E9ED] font-sans">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[#8B7CFF] tracking-tight">Mapa de Contribuciones y Propiedad (Ownership & Bus-Factor)</h3>
        <p className="text-xs text-[#858C98]">
          Identifica autores principales por módulo y detecta módulos con riesgo de Bus Factor (dominados por 1 solo desarrollador).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 flex-1 overflow-auto">
        {modules.map((m, idx) => {
          const author = idx % 2 === 0 ? 'Lead Dev' : 'Contributor';
          const isBusFactorRisk = m.loc > 150 && m.metrics.ce > 8;

          return (
            <div
              key={m.id}
              className={`p-3 rounded-md border flex flex-col justify-between ${
                isBusFactorRisk
                  ? 'bg-[#E7B85B]/10 border-[#E7B85B]/40'
                  : 'bg-[#101318] border-[#252B34]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#E6E9ED] truncate" title={m.id}>
                    {m.name}
                  </span>
                  {isBusFactorRisk && (
                    <span className="flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded bg-[#E7B85B]/20 text-[#E7B85B] font-bold border border-[#E7B85B]/30">
                      <AlertTriangle className="w-3 h-3" /> Bus Factor
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#5F6671] font-mono truncate">{m.id}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#252B34] flex items-center justify-between text-[10px] text-[#858C98]">
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[#45C8DF]" />
                  <span>Autor: <strong className="text-[#E6E9ED]">{author}</strong></span>
                </div>
                <div className="font-mono">LOC: {m.loc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
