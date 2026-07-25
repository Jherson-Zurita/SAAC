import React from 'react';
import { ShieldCheck, Cpu, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useAiStore } from '../../stores/useAiStore';

export const StatusBar: React.FC = () => {
  const { projectPath, isAnalyzing, progress, amg, fitnessResult } = useProjectStore();
  const { aiStatus } = useAiStore();

  const totalFiles = progress?.totalFiles || 0;
  const completedFiles = progress?.completedFiles || 0;
  const percent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  return (
    <footer className="h-6 bg-[#0a0c12] border-t border-[#1a1e2c] px-3 flex items-center justify-between text-[11px] font-mono text-gray-400 select-none z-30">
      {/* Izquierda: Estado del Proyecto */}
      <div className="flex items-center space-x-3 truncate">
        <div className="flex items-center space-x-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isAnalyzing
                ? 'bg-amber-400 animate-ping'
                : amg
                ? 'bg-emerald-400'
                : 'bg-gray-600'
            }`}
          />
          <span className="text-gray-300 font-medium truncate">
            {isAnalyzing
              ? `Analizando: ${progress?.phase || 'iniciando'}...`
              : projectPath
              ? `Proyecto: ${projectPath.split(/[/\\]/).pop()}`
              : 'SAAC Listo'}
          </span>
        </div>

        {projectPath && (
          <span className="text-gray-600 hidden md:inline truncate max-w-xs">{projectPath}</span>
        )}
      </div>

      {/* Centro: Barra de progreso activa */}
      {isAnalyzing && (
        <div className="flex items-center space-x-2 w-64 px-2">
          <div className="flex-1 bg-[#161a26] h-1.5 rounded-full overflow-hidden border border-[#232838]">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[10px] text-cyan-400 font-bold shrink-0">{percent}%</span>
        </div>
      )}

      {/* Derecha: Métricas y Estado IA */}
      <div className="flex items-center space-x-3 shrink-0">
        {fitnessResult && (
          <div className="flex items-center space-x-1 text-emerald-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Fitness: {fitnessResult.fitnessScore}</span>
          </div>
        )}

        {amg && amg.antipatterns.length > 0 && (
          <div className="flex items-center space-x-1 text-amber-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{amg.antipatterns.length} antipatrones</span>
          </div>
        )}

        <div className="flex items-center space-x-1 border-l border-[#1f2433] pl-2 text-gray-400">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px]">
            IA: {aiStatus?.available ? 'Ollama Activo' : 'Modo Mock'}
          </span>
        </div>
      </div>
    </footer>
  );
};
