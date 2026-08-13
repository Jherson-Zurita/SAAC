import React, { useEffect, useState } from 'react';
import { History, TrendingUp, ShieldAlert, CheckCircle } from 'lucide-react';
import type { AnalysisRunSummary, C4DiagramData } from '../../../shared/types';
import { getAnalysisHistory } from '../../lib/tauri-api';

interface TimelineViewProps {
  diagramData: C4DiagramData;
}

export const TimelineView: React.FC<TimelineViewProps> = () => {
  const [history, setHistory] = useState<AnalysisRunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAnalysisHistory();
        setHistory(data.runs || []);
      } catch (err) {
        console.error('Error cargando historial:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-4 text-center text-slate-400">Cargando línea de tiempo histórica...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 h-full">
        <History className="w-12 h-12 mb-3 text-slate-600" />
        <p className="font-semibold">Sin ejecuciones históricas registradas</p>
        <span className="text-xs text-slate-500 max-w-sm mt-1">
          Ejecute múltiples análisis del proyecto para rastrear la evolución de métricas y Fitness Score a lo largo del tiempo.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-4 overflow-auto bg-slate-900 text-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-sky-400">Línea de Tiempo de Evolución Arquitectónica</h3>
        <p className="text-xs text-slate-400">
          Tendencia de salud del proyecto a través de ejecuciones consecutivas de análisis (AnalysisRuns).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 border border-slate-700 bg-slate-950 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Último Fitness Score</div>
            <div className="text-2xl font-bold text-emerald-400">
              {history[history.length - 1]?.fitnessScore ?? 100} / 100
            </div>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-500/40" />
        </div>

        <div className="p-4 border border-slate-700 bg-slate-950 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Antipatrones Actuales</div>
            <div className="text-2xl font-bold text-amber-400">
              {history[history.length - 1]?.antipatternCount ?? 0} detectados
            </div>
          </div>
          <ShieldAlert className="w-8 h-8 text-amber-500/40" />
        </div>
      </div>

      <div className="border border-slate-700 rounded-lg p-3 bg-slate-950 flex-1 overflow-auto">
        <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sky-400" />
          Historial de Análisis ({history.length} ejecuciones)
        </h4>

        <div className="space-y-3">
          {history.map((run, idx) => (
            <div
              key={run.runId}
              className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-700"
            >
              <div className="space-y-1">
                <div className="text-xs font-mono font-semibold text-sky-300">
                  Run #{idx + 1} — {new Date(run.timestamp).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">
                  Módulos: {run.moduleCount} | Dependencias: {run.dependencyCount} | Duración: {run.durationMs}ms
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Fitness</div>
                  <div className="font-bold text-emerald-400">{run.fitnessScore}/100</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Antipatrones</div>
                  <div className="font-bold text-amber-400">{run.antipatternCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
