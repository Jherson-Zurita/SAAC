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
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : miAvg >= 60
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/30 bg-rose-500/10';

  return (
    <div className="bg-[#121520] border border-[#1e2333] rounded-xl p-5 shadow-lg space-y-4 select-none">
      {/* Header: Proyecto + Estilo Detectado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1e2333] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">{amg.projectName}</h2>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
              {amg.detectedType}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono break-all">{amg.projectId}</p>
        </div>

        {/* Badge Estilo Arquitectónico */}
        <div className="flex items-center space-x-2 bg-[#171b2a] px-3.5 py-2 rounded-lg border border-[#242c44]">
          <Zap className="w-4 h-4 text-cyan-400" />
          <div className="text-xs">
            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Estilo Detectado</span>
            <span className="font-bold text-cyan-300 capitalize">
              {amg.detectedStyle} <span className="text-gray-400 font-normal">({Math.round(amg.styleConfidence * 100)}%)</span>
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
        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Fitness Score</span>
          <div className="text-2xl font-black font-mono mt-1 text-blue-400">
            {fitnessResult ? fitnessResult.fitnessScore : Math.round(m.fitnessScore || 0)} <span className="text-xs opacity-70">/100</span>
          </div>
        </div>

        {/* Total Módulos */}
        <div className="p-3 rounded-lg border border-[#1e2333] bg-[#161a26] text-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Módulos</span>
          <div className="text-2xl font-black font-mono mt-1 text-cyan-400">{amg.modules.length}</div>
        </div>

        {/* Dependencias & Ciclos */}
        <div className="p-3 rounded-lg border border-[#1e2333] bg-[#161a26] text-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Dependencias</span>
          <div className="text-2xl font-black font-mono mt-1 text-purple-400">
            {amg.dependencies.length}
            {m.cyclicDependencyCount > 0 && (
              <span className="text-xs text-rose-400 font-normal ml-1 font-sans">({m.cyclicDependencyCount} ciclos)</span>
            )}
          </div>
        </div>

        {/* Complejidad Ciclomática Avg */}
        <div className="p-3 rounded-lg border border-[#1e2333] bg-[#161a26] text-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Complejidad CC</span>
          <div className="text-2xl font-black font-mono mt-1 text-amber-400">
            {(m.avgCyclomaticComplexity || 0).toFixed(1)}
          </div>
        </div>

        {/* Total LOC */}
        <div className="p-3 rounded-lg border border-[#1e2333] bg-[#161a26] text-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Líneas LOC</span>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
            {m.totalLoc.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
