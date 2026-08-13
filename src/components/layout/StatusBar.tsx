import React from 'react';
import { ShieldCheck, Cpu, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useAiStore } from '../../stores/useAiStore';
import { useSelectionStore } from '../../stores/useSelectionStore';

export const StatusBar: React.FC = () => {
  const { projectPath, isAnalyzing, progress, amg, fitnessResult } = useProjectStore();
  const { aiStatus } = useAiStore();
  const { selectedId } = useSelectionStore();

  const totalFiles = progress?.totalFiles || 0;
  const completedFiles = progress?.completedFiles || 0;
  const percent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  return (
    <footer className="h-[23px] bg-[#17152C] border-t border-[#252B34] px-3 flex items-center justify-between text-[9.5px] font-mono text-[#858C98] select-none z-30 shrink-0">
      {/* Left: Application State (GraphForge Spec Section 32) */}
      <div className="flex items-center space-x-3 truncate">
        <div className="flex items-center space-x-1.5">
          <span
            className={`text-[8px] ${
              isAnalyzing
                ? 'text-[#E7B85B] animate-pulse'
                : amg
                ? 'text-[#4FD49A]'
                : 'text-[#5F6671]'
            }`}
          >
            ●
          </span>
          <span className="text-[#E6E9ED] font-semibold truncate">
            {isAnalyzing
              ? `Analizando: ${progress?.phase || 'escaneando'}...`
              : projectPath
              ? `Proyecto: ${projectPath.split(/[/\\]/).pop()}`
              : 'Listo'}
          </span>
        </div>

        {amg && (
          <div className="flex items-center space-x-3 text-[#5F6671] border-l border-[#302C51] pl-3">
            <span>Nodos <strong className="text-[#E6E9ED] font-normal">{amg.modules.length}</strong></span>
            <span>Aristas <strong className="text-[#E6E9ED] font-normal">{amg.dependencies.length}</strong></span>
            {selectedId && (
              <span className="text-[#8B7CFF] truncate max-w-[140px]" title={selectedId}>
                Selección: {selectedId.split('/').pop()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Active Progress Bar */}
      {isAnalyzing && (
        <div className="flex items-center space-x-2 w-48 px-2">
          <div className="flex-1 bg-[#101318] h-1 rounded-full overflow-hidden border border-[#252B34]">
            <div
              className="bg-[#8B7CFF] h-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[9px] text-[#8B7CFF] font-bold shrink-0">{percent}%</span>
        </div>
      )}

      {/* Right: Technical Metadata (GraphForge Spec Section 32) */}
      <div className="flex items-center space-x-3 shrink-0">
        {fitnessResult && (
          <div className="flex items-center space-x-1 text-[#4FD49A] font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>FS: {fitnessResult.fitnessScore}/100</span>
          </div>
        )}

        {amg && amg.antipatterns.length > 0 && (
          <div className="flex items-center space-x-1 text-[#E7B85B]">
            <AlertTriangle className="w-3 h-3" />
            <span>{amg.antipatterns.length} antipatrones</span>
          </div>
        )}

        <div className="flex items-center space-x-3 border-l border-[#302C51] pl-3 text-[#5F6671]">
          <span className="flex items-center gap-1 text-[#45C8DF]">
            <Cpu className="w-3 h-3" />
            {aiStatus?.available ? 'Ollama' : 'Mock IA'}
          </span>
          <span>UTF-8</span>
          <span className="text-[#8B7CFF] font-bold">SAAC 2.0</span>
        </div>
      </div>
    </footer>
  );
};
