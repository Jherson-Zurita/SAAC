import React from 'react';
import { Zap } from 'lucide-react';
import type { ArchitectureModelGraph, FitnessEvaluationResult } from '../../../shared/types';

interface ProjectSummaryCardProps {
  amg: ArchitectureModelGraph;
  fitnessResult?: FitnessEvaluationResult | null;
}

export const ProjectSummaryCard: React.FC<ProjectSummaryCardProps> = ({
  amg,
  fitnessResult,
}) => {
  const m = amg.metrics;
  const miAvg = Math.round(m.maintainabilityIndexAvg || 0);

  const miColorClass =
    miAvg >= 80
      ? 'text-[var(--green)] border-[var(--green)]/30 bg-[var(--green)]/10'
      : miAvg >= 60
      ? 'text-[var(--yellow)] border-[var(--yellow)]/30 bg-[var(--yellow)]/10'
      : 'text-[var(--red)] border-[var(--red)]/30 bg-[var(--red)]/10';

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 shadow-lg space-y-4 select-none">
      {/* Header: Proyecto + Estilo Detectado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-[var(--text)] tracking-tight">{amg.projectName}</h2>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--cyan)]/10 text-[var(--cyan)] border border-[var(--cyan)]/20 font-semibold">
              {amg.detectedType}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1 font-mono break-all">{amg.projectId}</p>
        </div>

        {/* Badge Estilo Arquitectónico */}
        <div className="flex items-center space-x-2 bg-[var(--panel-2)] px-3.5 py-2 rounded-lg border border-[var(--border-soft)]">
          <Zap className="w-4 h-4 text-[var(--cyan)]" />
          <div className="text-xs">
            <span className="text-[var(--muted)] block text-[10px] uppercase font-semibold">Estilo Detectado</span>
            <span className="font-bold text-[var(--cyan)] capitalize">
              {amg.detectedStyle} <span className="text-[var(--muted)] font-normal">({Math.round(amg.styleConfidence * 100)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Métricas Agregadas Clave */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* MI Promedio */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${miColorClass}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">MI Promedio</span>
          <div className="text-2xl font-black font-mono mt-1">{miAvg} <span className="text-xs opacity-70">/100</span></div>
        </div>

        {/* Fitness Score */}
        <div className="p-3 rounded-lg border border-[var(--purple-border)] bg-[var(--purple-soft)] text-[var(--purple)] flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--purple)]">Fitness Score</span>
          <div className="text-2xl font-black font-mono mt-1 text-[var(--purple)]">
            {fitnessResult ? fitnessResult.fitnessScore : Math.round(m.fitnessScore || 0)} <span className="text-xs opacity-70">/100</span>
          </div>
        </div>

        {/* Total Módulos */}
        <div className="p-3 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)] text-[var(--text)] flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Módulos</span>
          <div className="text-2xl font-black font-mono mt-1 text-[var(--cyan)]">{amg.modules.length}</div>
        </div>

        {/* Dependencias & Ciclos */}
        <div className="p-3 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)] text-[var(--text)] flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Dependencias</span>
          <div className="text-2xl font-black font-mono mt-1 text-[var(--purple)]">
            {amg.dependencies.length}
            {m.cyclicDependencyCount > 0 && (
              <span className="text-xs text-[var(--red)] font-normal ml-1 font-sans">({m.cyclicDependencyCount} ciclos)</span>
            )}
          </div>
        </div>

        {/* Complejidad Ciclomática Avg */}
        <div className="p-3 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)] text-[var(--text)] flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Complejidad CC</span>
          <div className="text-2xl font-black font-mono mt-1 text-[var(--yellow)]">
            {(m.avgCyclomaticComplexity || 0).toFixed(1)}
          </div>
        </div>

        {/* Total LOC */}
        <div className="p-3 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)] text-[var(--text)] flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Líneas LOC</span>
          <div className="text-2xl font-black font-mono mt-1 text-[var(--green)]">
            {m.totalLoc.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
