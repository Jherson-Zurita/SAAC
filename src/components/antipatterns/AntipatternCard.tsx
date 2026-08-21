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
    badgeClass: 'bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30',
    iconClass: 'text-[var(--red)]',
  },
  high: {
    label: 'Alto',
    badgeClass: 'bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/30',
    iconClass: 'text-[var(--yellow)]',
  },
  medium: {
    label: 'Medio',
    badgeClass: 'bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/30',
    iconClass: 'text-[var(--yellow)]',
  },
  low: {
    label: 'Bajo',
    badgeClass: 'bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]/30',
    iconClass: 'text-[var(--cyan)]',
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-[var(--purple)]/10 text-[var(--purple)] border-[var(--purple)]/30',
    iconClass: 'text-[var(--purple)]',
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
    <div className={`bg-[var(--panel)] border rounded-xl p-5 shadow-lg space-y-3 transition ${
      antipattern.ignored ? 'opacity-50 border-[var(--border)]' : 'border-[var(--border)] hover:border-[var(--purple)]/40'
    }`}>
      {/* Header: Tipo + Severidad + Badge Ignorado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className={`w-5 h-5 ${sev.iconClass} shrink-0`} />
          <div>
            <h4 className="text-sm font-bold text-[var(--text)]">{antipattern.name}</h4>
            <span className="text-[10px] font-mono text-[var(--muted-2)] uppercase tracking-wider">
              {antipattern.antipatternType}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${sev.badgeClass}`}>
            {sev.label}
          </span>
          {antipattern.ignored && (
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--panel-2)] text-[var(--muted)] border border-[var(--border-soft)] flex items-center space-x-1">
              <EyeOff className="w-3 h-3" />
              <span>Ignorado</span>
            </span>
          )}
        </div>
      </div>

      {/* Descripción */}
      <p className="text-xs text-[var(--text)] leading-relaxed font-normal">{antipattern.description}</p>

      {/* Si es Dependencia Circular: Cadena visual de ciclo */}
      {antipattern.antipatternType === 'circular-dependency' && antipattern.cyclePath && (
        <div className="bg-[var(--bg)] p-3 rounded-lg border border-[var(--border-soft)] space-y-2">
          <span className="text-[10px] uppercase font-semibold text-[var(--red)] tracking-wider flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Ruta del Ciclo Detectado</span>
          </span>

          <div className="flex items-center space-x-2 overflow-x-auto py-1 font-mono text-xs text-[var(--cyan)]">
            {antipattern.cyclePath.map((step, idx) => (
              <React.Fragment key={idx}>
                <span
                  onClick={() => {
                    const mod = amg?.modules.find((m) => m.id === step || m.name === step);
                    if (mod) selectElement(mod.id, 'module', mod);
                  }}
                  className="px-2 py-1 rounded bg-[var(--panel-2)] border border-[var(--cyan)]/30 hover:bg-[var(--cyan)]/20 cursor-pointer transition shrink-0"
                >
                  {step}
                </span>
                {idx < antipattern.cyclePath!.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-2)] shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Punto de Ruptura Recomendado */}
          {antipattern.suggestedBreakPoint && (
            <div className="flex items-center space-x-2 text-xs text-[var(--yellow)] bg-[var(--yellow)]/10 p-2 rounded border border-[var(--yellow)]/20">
              <Scissors className="w-4 h-4 text-[var(--yellow)] shrink-0" />
              <span>
                Punto de ruptura recomendado: <strong className="font-mono">{antipattern.suggestedBreakPoint}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sugerencia de refactorización */}
      {antipattern.refactorSuggestion && (
        <div className="flex items-start space-x-2 text-xs text-[var(--cyan)] bg-[var(--cyan)]/10 p-2.5 rounded-lg border border-[var(--cyan)]/20">
          <Lightbulb className="w-4 h-4 text-[var(--cyan)] shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[10px] uppercase font-bold text-[var(--cyan)]">Sugerencia de Refactorización</strong>
            <p className="mt-0.5 text-[var(--text)]">{antipattern.refactorSuggestion}</p>
          </div>
        </div>
      )}

      {/* Módulos Afectados */}
      {antipattern.affectedModuleIds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-semibold text-[var(--muted)] tracking-wider">Módulos Afectados</span>
          <div className="flex flex-wrap gap-1.5">
            {antipattern.affectedModuleIds.map((modId) => {
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

      {/* Justificación de Ignorado si existe */}
      {antipattern.ignored && antipattern.ignoreJustification && (
        <div className="p-2.5 rounded bg-[var(--panel-2)] border border-[var(--border-soft)] text-xs text-[var(--muted)]">
          <strong className="text-[var(--text)] block text-[10px] uppercase">Motivo del ignorado:</strong>
          <p className="mt-0.5 italic">"{antipattern.ignoreJustification}"</p>
        </div>
      )}

      {/* Formulario para Ignorar Antipatrón */}
      {!antipattern.ignored && (
        <div className="pt-2 border-t border-[var(--border-soft)]">
          {!isIgnoring ? (
            <button
              onClick={() => setIsIgnoring(true)}
              className="flex items-center space-x-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] transition font-semibold"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ignorar este antipatrón...</span>
            </button>
          ) : (
            <div className="space-y-2 bg-[var(--bg)] p-3 rounded-lg border border-[var(--border)]">
              <label className="block text-xs font-bold text-[var(--text)]">
                Justificación para ignorar:
              </label>
              <input
                type="text"
                placeholder="Ej. Deuda técnica aceptada temporalmente hasta Sprint 4..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full bg-[var(--panel)] text-xs text-[var(--text)] px-3 py-1.5 rounded border border-[var(--border)] focus:outline-none focus:border-[var(--cyan)]"
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setIsIgnoring(false)}
                  className="px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleIgnore}
                  disabled={loading || !justification.trim()}
                  className="px-3 py-1 bg-[var(--red)] hover:opacity-90 text-white text-xs font-bold rounded disabled:opacity-50 transition flex items-center space-x-1 shadow"
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
