import React from 'react';
import { AlertTriangle, ShieldCheck, FileCode } from 'lucide-react';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Risk } from '../../../shared/types';

interface RiskCardProps {
  risk: Risk;
}

const severityConfig: Record<
  Risk['severity'],
  { label: string; badgeClass: string; iconClass: string }
> = {
  Critical: {
    label: 'Crítico',
    badgeClass: 'bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30',
    iconClass: 'text-[var(--red)]',
  },
  High: {
    label: 'Alto',
    badgeClass: 'bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/30',
    iconClass: 'text-[var(--yellow)]',
  },
  Medium: {
    label: 'Medio',
    badgeClass: 'bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/30',
    iconClass: 'text-[var(--yellow)]',
  },
  Low: {
    label: 'Bajo',
    badgeClass: 'bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]/30',
    iconClass: 'text-[var(--cyan)]',
  },
};

export const RiskCard: React.FC<RiskCardProps> = ({ risk }) => {
  const { selectElement } = useSelectionStore();
  const { amg } = useProjectStore();

  const sev = severityConfig[risk.severity] || severityConfig.Medium;

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--purple)]/40 rounded-xl p-5 shadow-lg space-y-3 transition font-sans">
      {/* Header: Título & Severidad */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <AlertTriangle className={`w-5 h-5 ${sev.iconClass} shrink-0`} />
          <div>
            <h4 className="text-sm font-bold text-[var(--text)]">{risk.title}</h4>
            <span className="text-[10px] font-mono text-[var(--muted-2)] uppercase tracking-wider">
              Riesgo Técnico de Arquitectura
            </span>
          </div>
        </div>

        <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded border font-semibold ${sev.badgeClass}`}>
          {sev.label}
        </span>
      </div>

      {/* Descripción del Riesgo */}
      <p className="text-xs text-[var(--text)] leading-relaxed font-normal">{risk.description}</p>

      {/* Estrategia de Mitigación */}
      <div className="flex items-start space-x-2 text-xs text-[var(--green)] bg-[var(--green)]/10 p-3 rounded-lg border border-[var(--green)]/20">
        <ShieldCheck className="w-4 h-4 text-[var(--green)] shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[10px] uppercase font-bold text-[var(--green)]">
            Estrategia de Mitigación Recomendada
          </strong>
          <p className="mt-0.5 text-[var(--text)]">{risk.mitigation}</p>
        </div>
      </div>

      {/* Módulos Afectados */}
      {risk.affectedModuleIds && risk.affectedModuleIds.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] uppercase font-semibold text-[var(--muted)] tracking-wider">
            Módulos Afectados
          </span>
          <div className="flex flex-wrap gap-1.5">
            {risk.affectedModuleIds.map((modId) => {
              const mod = amg?.modules.find((m) => m.id === modId);
              return (
                <button
                  key={modId}
                  onClick={() => {
                    if (mod) selectElement(mod.id, 'module', mod);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-[var(--panel-2)] hover:bg-[var(--purple-soft)] text-[var(--text)] hover:text-[var(--purple)] border border-[var(--border-soft)] hover:border-[var(--purple-border)] text-xs font-mono transition"
                >
                  <FileCode className="w-3 h-3 text-[var(--cyan)]" />
                  <span>{mod?.name || modId}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
