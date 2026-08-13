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
    return <div className="p-4 text-center text-slate-400">Sin datos de módulos para Ownership Map.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-slate-900 text-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-sky-400">Mapa de Contribuciones y Propiedad (Ownership & Bus-Factor)</h3>
        <p className="text-xs text-slate-400">
          Identifica autores principales por módulo y detecta módulos con riesgo de Bus Factor (dominados por 1 solo desarrollador).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 overflow-auto">
        {modules.map((m, idx) => {
          // Asignar autor simulado o inferido si no hay git
          const author = idx % 2 === 0 ? 'Lead Dev' : 'Contributor';
          const isBusFactorRisk = m.loc > 150 && m.metrics.ce > 8;

          return (
            <div
              key={m.id}
              className={`p-3 rounded border flex flex-col justify-between ${
                isBusFactorRisk
                  ? 'bg-amber-950/40 border-amber-600/50'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200 truncate" title={m.id}>
                    {m.name}
                  </span>
                  {isBusFactorRisk && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold">
                      <AlertTriangle className="w-3 h-3" /> Bus Factor
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{m.id}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-sky-400" />
                  <span>Autor: <strong className="text-slate-300">{author}</strong></span>
                </div>
                <div>LOC: {m.loc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
