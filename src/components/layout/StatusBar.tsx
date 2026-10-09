import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cpu, AlertTriangle } from 'lucide-react';
import type { WorkersStatus } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';
import { useAiStore } from '../../stores/useAiStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { getWorkersStatus } from '../../lib/tauri-api';

export const StatusBar: React.FC = () => {
  const { projectPath, isAnalyzing, progress, amg, fitnessResult } = useProjectStore();
  const { aiStatus } = useAiStore();
  const { selectedId } = useSelectionStore();
  const [workers, setWorkers] = useState<WorkersStatus | null>(null);

  useEffect(() => {
    getWorkersStatus()
      .then(setWorkers)
      .catch((err) => console.warn('No se pudo consultar el estado de los workers:', err));
  }, []);

  const unavailableWorkers = workers
    ? [
        !workers.node.available && {
          label: 'Node.js (TS/JS)',
          message: workers.node.message,
        },
        !workers.python.available && {
          label: 'Python (Python/Java/C#/Kotlin/Go/Rust/Swift)',
          message: workers.python.message,
        },
      ].filter((w): w is { label: string; message: string | null } => Boolean(w))
    : [];

  const totalFiles = progress?.totalFiles || 0;
  const completedFiles = progress?.completedFiles || 0;
  const percent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  const providerLabel =
    aiStatus?.provider === 'ollama'
      ? 'Ollama'
      : aiStatus?.provider === 'open-ai-compatible'
      ? 'OpenAI compatible'
      : 'Mock IA';
  const aiLabel = !aiStatus
    ? 'IA sin verificar'
    : aiStatus.provider === 'mock' || aiStatus.available
    ? providerLabel
    : `${providerLabel} (sin conexión)`;

  return (
    <footer className="h-[23px] bg-[var(--purple-soft)] border-t border-[var(--purple-border)] px-3 flex items-center justify-between text-[9.5px] font-mono text-[var(--muted)] select-none z-30 shrink-0 transition-colors duration-200">
      {/* Left: Application State */}
      <div className="flex items-center space-x-3 truncate">
        <div className="flex items-center space-x-1.5">
          <span
            className={`text-[8px] ${
              isAnalyzing
                ? 'text-[var(--yellow)] animate-pulse'
                : amg
                ? 'text-[var(--green)]'
                : 'text-[var(--muted-2)]'
            }`}
          >
            ●
          </span>
          <span className="text-[var(--text)] font-semibold truncate">
            {isAnalyzing
              ? `Analizando: ${progress?.phase || 'escaneando'}...`
              : projectPath
              ? `Proyecto: ${projectPath.split(/[/\\]/).pop()}`
              : 'Listo'}
          </span>
        </div>

        {amg && (
          <div className="flex items-center space-x-3 text-[var(--muted-2)] border-l border-[var(--purple-border)] pl-3">
            <span>Nodos <strong className="text-[var(--text)] font-normal">{amg.modules.length}</strong></span>
            <span>Aristas <strong className="text-[var(--text)] font-normal">{amg.dependencies.length}</strong></span>
            {selectedId && (
              <span className="text-[var(--purple)] truncate max-w-[140px]" title={selectedId}>
                Selección: {selectedId.split('/').pop()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Active Progress Bar */}
      {isAnalyzing && (
        <div className="flex items-center space-x-2 w-48 px-2">
          <div className="flex-1 bg-[var(--panel)] h-1 rounded-full overflow-hidden border border-[var(--purple-border)]">
            <div
              className="bg-[var(--purple)] h-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[9px] text-[var(--purple)] font-bold shrink-0">{percent}%</span>
        </div>
      )}

      {/* Right: Technical Metadata */}
      <div className="flex items-center space-x-3 shrink-0">
        {unavailableWorkers.length > 0 && (
          <div
            className="flex items-center space-x-1 text-[var(--red)] font-bold"
            title={unavailableWorkers
              .map((w) => `${w.label}: ${w.message ?? 'no disponible'}`)
              .join('\n\n')}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>
              Worker no disponible: {unavailableWorkers.map((w) => w.label.split(' ')[0]).join(', ')}
            </span>
          </div>
        )}

        {fitnessResult && (
          <div className="flex items-center space-x-1 text-[var(--green)] font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>FS: {fitnessResult.fitnessScore}/100</span>
          </div>
        )}

        {amg && amg.antipatterns.length > 0 && (
          <div className="flex items-center space-x-1 text-[var(--yellow)]">
            <AlertTriangle className="w-3 h-3" />
            <span>{amg.antipatterns.length} antipatrones</span>
          </div>
        )}

        <div className="flex items-center space-x-3 border-l border-[var(--purple-border)] pl-3 text-[var(--muted-2)]">
          <span
            className={`flex items-center gap-1 ${
              aiStatus && !aiStatus.available && aiStatus.provider !== 'mock'
                ? 'text-[var(--yellow)]'
                : 'text-[var(--cyan)]'
            }`}
            title={aiStatus?.message}
          >
            <Cpu className="w-3 h-3" />
            {aiLabel}
          </span>
          <span>UTF-8</span>
          <span className="text-[var(--purple)] font-bold">SAAC 2.0</span>
        </div>
      </div>
    </footer>
  );
};
