import React, { useEffect, useState } from 'react';
import { History, TrendingUp, ShieldAlert, CheckCircle } from 'lucide-react';
import type { AnalysisRunSummary, C4DiagramData } from '../../../shared/types';
import { getAnalysisHistory } from '../../lib/tauri-api';
import { useProjectStore } from '../../stores/useProjectStore';

interface TimelineViewProps {
  diagramData: C4DiagramData;
}

export const TimelineView: React.FC<TimelineViewProps> = () => {
  const { projectPath } = useProjectStore();
  const [history, setHistory] = useState<AnalysisRunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAnalysisHistory(projectPath || '.');
        setHistory(data.runs || []);
      } catch (err) {
        console.error('Error cargando historial:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectPath]);

  if (loading) {
    return <div className="p-4 text-center text-[var(--muted)] font-sans text-xs">Cargando línea de tiempo histórica...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--muted)] h-full font-sans">
        <History className="w-10 h-10 mb-2 text-[var(--muted-2)]" />
        <p className="font-semibold text-[var(--text)]">Sin ejecuciones históricas registradas</p>
        <span className="text-xs text-[var(--muted-2)] max-w-sm mt-1">
          Ejecute múltiples análisis del proyecto para rastrear la evolución de métricas y Fitness Score a lo largo del tiempo.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-200">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--purple)] tracking-tight">Línea de Tiempo de Evolución Arquitectónica</h3>
        <p className="text-xs text-[var(--muted)]">
          Tendencia de salud del proyecto a través de ejecuciones consecutivas de análisis (AnalysisRuns).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="p-3 border border-[var(--border)] bg-[var(--panel)] rounded-md flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[var(--muted)]">Último Fitness Score</div>
            <div className="text-xl font-bold text-[var(--green)] font-mono">
              {history[history.length - 1]?.fitnessScore ?? 100} / 100
            </div>
          </div>
          <CheckCircle className="w-7 h-7 text-[var(--green)]/40" />
        </div>

        <div className="p-3 border border-[var(--border)] bg-[var(--panel)] rounded-md flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[var(--muted)]">Antipatrones Actuales</div>
            <div className="text-xl font-bold text-[var(--yellow)] font-mono">
              {history[history.length - 1]?.antipatternCount ?? 0} detectados
            </div>
          </div>
          <ShieldAlert className="w-7 h-7 text-[var(--yellow)]/40" />
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-md p-3 bg-[var(--panel)] flex-1 overflow-auto">
        <h4 className="text-xs font-semibold text-[var(--muted)] mb-2.5 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[var(--cyan)]" />
          Historial de Análisis ({history.length} ejecuciones)
        </h4>

        <div className="space-y-2">
          {history.map((run, idx) => (
            <div
              key={run.runId}
              className="flex items-center justify-between p-2.5 rounded bg-[var(--panel-2)] border border-[var(--border-soft)] hover:border-[var(--purple)]/40 transition"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-mono font-semibold text-[var(--purple)]">
                  Run #{idx + 1} — {new Date(run.timestamp).toLocaleString()}
                </div>
                <div className="text-[10px] text-[var(--muted)] font-mono">
                  Módulos: {run.moduleCount} | Dependencias: {run.dependencyCount} | Duración: {run.durationMs}ms
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-right">
                  <div className="text-[9px] text-[var(--muted-2)]">Fitness</div>
                  <div className="font-bold text-[var(--green)]">{run.fitnessScore} / 100</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-[var(--muted-2)]">Antipatrones</div>
                  <div className="font-bold text-[var(--yellow)]">{run.antipatternCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
