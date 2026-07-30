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
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    iconClass: 'text-rose-400',
  },
  High: {
    label: 'Alto',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconClass: 'text-amber-400',
  },
  Medium: {
    label: 'Medio',
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    iconClass: 'text-yellow-400',
  },
  Low: {
    label: 'Bajo',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    iconClass: 'text-cyan-400',
  },
};

export const RiskCard: React.FC<RiskCardProps> = ({ risk }) => {
  const { selectElement } = useSelectionStore();
  const { amg } = useProjectStore();

  const sev = severityConfig[risk.severity] || severityConfig.Medium;

  return (
    <div className="bg-[#121520] border border-[#1e2333] hover:border-[#2a3147] rounded-xl p-5 shadow-lg space-y-3 transition">
      {/* Header: Título & Severidad */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <AlertTriangle className={`w-5 h-5 ${sev.iconClass} shrink-0`} />
          <div>
            <h4 className="text-sm font-bold text-gray-100">{risk.title}</h4>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              Riesgo Técnico de Arquitectura
            </span>
          </div>
        </div>

        <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded border font-semibold ${sev.badgeClass}`}>
          {sev.label}
        </span>
      </div>

      {/* Descripción del Riesgo */}
      <p className="text-xs text-gray-300 leading-relaxed font-normal">{risk.description}</p>

      {/* Estrategia de Mitigación */}
      <div className="flex items-start space-x-2 text-xs text-emerald-300 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-[10px] uppercase font-bold text-emerald-400">
            Estrategia de Mitigación Recomendada
          </strong>
          <p className="mt-0.5 text-gray-200">{risk.mitigation}</p>
        </div>
      </div>

      {/* Módulos Afectados */}
      {risk.affectedModuleIds && risk.affectedModuleIds.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
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
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-[#161a26] hover:bg-blue-600/30 text-gray-300 hover:text-blue-300 border border-[#232a3e] hover:border-blue-500/40 text-xs font-mono transition"
                >
                  <FileCode className="w-3 h-3 text-cyan-400" />
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
