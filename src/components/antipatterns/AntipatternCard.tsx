import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Scissors,
  Lightbulb,
  CheckCircle2,
  EyeOff,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { ignoreAntipattern } from '../../lib/tauri-api';
import type { Antipattern, Severity } from '../../../shared/types';

interface AntipatternCardProps {
  antipattern: Antipattern;
}

const severityConfig: Record<
  Severity,
  { label: string; badgeClass: string; iconClass: string }
> = {
  critical: {
    label: 'Crítico',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    iconClass: 'text-rose-400',
  },
  high: {
    label: 'Alto',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconClass: 'text-amber-400',
  },
  medium: {
    label: 'Medio',
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    iconClass: 'text-yellow-400',
  },
  low: {
    label: 'Bajo',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    iconClass: 'text-cyan-400',
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconClass: 'text-blue-400',
  },
};

export const AntipatternCard: React.FC<AntipatternCardProps> = ({ antipattern }) => {
  const { selectElement } = useSelectionStore();
  const { amg, projectPath, setAnnotations } = useProjectStore();

  const [isIgnoring, setIsIgnoring] = useState(false);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);

  const sev = severityConfig[antipattern.severity] || severityConfig.medium;

  const handleIgnore = async () => {
    if (!projectPath || !justification.trim()) return;
    setLoading(true);

    try {
      const updated = await ignoreAntipattern(
        projectPath,
        antipattern.id,
        justification.trim(),
        'Usuario SAAC'
      );
      setAnnotations(updated);
      setIsIgnoring(false);
    } catch (err) {
      console.error('Error al ignorar antipatrón:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-[#121520] border rounded-xl p-5 shadow-lg space-y-3 transition ${
      antipattern.ignored ? 'opacity-50 border-[#1e2333]' : 'border-[#1e2333] hover:border-[#2a3147]'
    }`}>
      {/* Header: Tipo + Severidad + Badge Ignorado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className={`w-5 h-5 ${sev.iconClass} shrink-0`} />
          <div>
            <h4 className="text-sm font-bold text-gray-100">{antipattern.name}</h4>
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              {antipattern.antipatternType}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${sev.badgeClass}`}>
            {sev.label}
          </span>
          {antipattern.ignored && (
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 flex items-center space-x-1">
              <EyeOff className="w-3 h-3" />
              <span>Ignorado</span>
            </span>
          )}
        </div>
      </div>

      {/* Descripción */}
      <p className="text-xs text-gray-300 leading-relaxed font-normal">{antipattern.description}</p>

      {/* Si es Dependencia Circular: Cadena visual de ciclo */}
      {antipattern.antipatternType === 'circular-dependency' && antipattern.cyclePath && (
        <div className="bg-[#090b10] p-3 rounded-lg border border-[#1e2333] space-y-2">
          <span className="text-[10px] uppercase font-semibold text-rose-400 tracking-wider flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Ruta del Ciclo Detectado</span>
          </span>

          <div className="flex items-center space-x-2 overflow-x-auto py-1 font-mono text-xs text-cyan-300">
            {antipattern.cyclePath.map((step, idx) => (
              <React.Fragment key={idx}>
                <span
                  onClick={() => {
                    const mod = amg?.modules.find((m) => m.id === step || m.name === step);
                    if (mod) selectElement(mod.id, 'module', mod);
                  }}
                  className="px-2 py-1 rounded bg-[#161a26] border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer transition shrink-0"
                >
                  {step}
                </span>
                {idx < antipattern.cyclePath!.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Punto de Ruptura Recomendado */}
          {antipattern.suggestedBreakPoint && (
            <div className="flex items-center space-x-2 text-xs text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20">
              <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Punto de ruptura recomendado: <strong className="font-mono">{antipattern.suggestedBreakPoint}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sugerencia de refactorización */}
      {antipattern.refactorSuggestion && (
        <div className="flex items-start space-x-2 text-xs text-cyan-300 bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20">
          <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[10px] uppercase font-bold text-cyan-400">Sugerencia de Refactorización</strong>
            <p className="mt-0.5 text-gray-200">{antipattern.refactorSuggestion}</p>
          </div>
        </div>
      )}

      {/* Módulos Afectados */}
      {antipattern.affectedModuleIds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Módulos Afectados</span>
          <div className="flex flex-wrap gap-1.5">
            {antipattern.affectedModuleIds.map((modId) => {
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

      {/* Justificación de Ignorado si existe */}
      {antipattern.ignored && antipattern.ignoreJustification && (
        <div className="p-2.5 rounded bg-gray-900 border border-gray-800 text-xs text-gray-400">
          <strong className="text-gray-300 block text-[10px] uppercase">Motivo del ignorado:</strong>
          <p className="mt-0.5 italic">"{antipattern.ignoreJustification}"</p>
        </div>
      )}

      {/* Formulario para Ignorar Antipatrón */}
      {!antipattern.ignored && (
        <div className="pt-2 border-t border-[#1e2333]">
          {!isIgnoring ? (
            <button
              onClick={() => setIsIgnoring(true)}
              className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-gray-200 transition font-semibold"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ignorar este antipatrón...</span>
            </button>
          ) : (
            <div className="space-y-2 bg-[#090b10] p-3 rounded-lg border border-[#1e2333]">
              <label className="block text-xs font-bold text-gray-300">
                Justificación para ignorar:
              </label>
              <input
                type="text"
                placeholder="Ej. Deuda técnica aceptada temporalmente hasta Sprint 4..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full bg-[#121520] text-xs text-gray-200 px-3 py-1.5 rounded border border-[#1e2333] focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setIsIgnoring(false)}
                  className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleIgnore}
                  disabled={loading || !justification.trim()}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded disabled:opacity-50 transition flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
