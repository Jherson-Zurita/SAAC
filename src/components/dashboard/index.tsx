import React from 'react';
import { ProjectSummaryCard } from './ProjectSummaryCard';
import { MetricsRadarChart } from './MetricsRadarChart';
import { DependencyGraphOverview } from './DependencyGraphOverview';
import { useProjectStore } from '../../stores/useProjectStore';
import { LayoutDashboard } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { amg, fitnessResult } = useProjectStore();

  if (!amg) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--muted)]">
        <LayoutDashboard className="w-12 h-12 text-[var(--purple)]/40 mb-2" />
        <p className="font-semibold text-sm text-[var(--text)]">No hay datos de análisis disponibles.</p>
        <p className="text-xs text-[var(--muted)]">Abra un proyecto e inicie el análisis para ver el Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--bg)] text-[var(--text)] transition-colors duration-200 font-sans">
      {/* Tarjeta de Resumen del Proyecto */}
      <ProjectSummaryCard amg={amg} fitnessResult={fitnessResult} />

      {/* Grid: Radar de Salud Arquitectónica & Vista Previa del Grafo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <MetricsRadarChart
            metrics={amg.metrics}
            fitnessScore={fitnessResult?.fitnessScore || amg.metrics.fitnessScore}
          />
        </div>

        <div className="lg:col-span-2">
          <DependencyGraphOverview amg={amg} />
        </div>
      </div>
    </div>
  );
};
