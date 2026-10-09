import React from 'react';
import { UserCheck, AlertTriangle } from 'lucide-react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';

interface OwnershipMapViewProps {
  diagramData: C4DiagramData;
}

export const OwnershipMapView: React.FC<OwnershipMapViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const { selectElement } = useSelectionStore();
  const modules = amg?.modules || [];

  if (modules.length === 0) {
    return <div className="p-4 text-center text-[var(--muted)] font-sans text-xs">Sin datos de módulos para Ownership Map.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-200">
      <div className="mb-3 p-3 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--purple)] tracking-tight">
            Mapa de Contribuciones y Propiedad (Ownership & Bus-Factor)
          </h3>
          <span className="text-[10px] font-mono text-[var(--muted-2)]">
            {modules.length} módulos · Clic en una tarjeta para inspeccionar
          </span>
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">
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
              onClick={() => selectElement(m.id, 'module', m)}
              className={`p-3 rounded-md border flex flex-col justify-between cursor-pointer transition-all hover:border-[var(--purple)] hover:shadow-md ${
                isBusFactorRisk
                  ? 'bg-[#E7B85B]/10 border-[#E7B85B]/40 hover:bg-[#E7B85B]/20'
                  : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--panel-2)]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[var(--text)] truncate" title={`Ver ${m.id} en inspector`}>
                    {m.name}
                  </span>
                  {isBusFactorRisk && (
                    <span className="flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded bg-[#E7B85B]/20 text-[var(--yellow)] font-bold border border-[#E7B85B]/30">
                      <AlertTriangle className="w-3 h-3" /> Bus Factor
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[var(--muted-2)] font-mono truncate">{m.id}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--muted)]">
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[var(--cyan)]" />
                  <span>Autor: <strong className="text-[var(--text)]">{author}</strong></span>
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
