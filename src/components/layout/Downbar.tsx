import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  AlertTriangle,
  History,
  FileText,
  X,
  Send,
} from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useAnalysisHistoryStore } from '../../stores/useAnalysisHistoryStore';
import { executeConsoleCommand } from '../../lib/tauri-api';

export const Downbar: React.FC = () => {
  const { downbarOpen, activeDownbarTab, setActiveDownbarTab, toggleDownbar } = useUiStore();
  const { projectPath, lastAnalysisResult, amg } = useProjectStore();
  const { history } = useAnalysisHistoryStore();

  const [consoleInput, setConsoleInput] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ text: string; type: 'cmd' | 'output' | 'error' }>>([
    { text: 'SAAC Workspace Console v2.0 ready. Type "help" for commands.', type: 'output' },
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  if (!downbarOpen) return null;

  const handleConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;

    const cmd = consoleInput.trim();
    setConsoleInput('');

    setConsoleLogs((prev) => [...prev, { text: `saac> ${cmd}`, type: 'cmd' }]);

    try {
      const res = await executeConsoleCommand(cmd, projectPath || undefined);
      if (res.data && (res.data as any).action === 'clear') {
        setConsoleLogs([]);
        return;
      }
      setConsoleLogs((prev) => [
        ...prev,
        { text: res.message, type: res.success ? 'output' : 'error' },
      ]);
    } catch (err: any) {
      setConsoleLogs((prev) => [
        ...prev,
        { text: `Error: ${err.toString()}`, type: 'error' },
      ]);
    }
  };

  return (
    <footer className="h-[166px] bg-[var(--panel)] border-t border-[var(--border)] flex flex-col select-none z-10 font-sans shrink-0 transition-colors duration-200">
      {/* Header de pestañas (GraphForge Spec Section 30) */}
      <div className="h-[32px] px-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveDownbarTab('console')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'console'
                ? 'border-[var(--purple)] text-[var(--text)] bg-[var(--panel)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <TerminalIcon className="w-3 h-3 text-[var(--purple)]" />
            <span>TERMINAL</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('problems')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'problems'
                ? 'border-[var(--purple)] text-[var(--text)] bg-[var(--panel)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-[var(--yellow)]" />
            <span>PROBLEMAS ({amg?.antipatterns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('output')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'output'
                ? 'border-[var(--purple)] text-[var(--text)] bg-[var(--panel)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <FileText className="w-3 h-3 text-[var(--cyan)]" />
            <span>OUTPUT</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('history')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'history'
                ? 'border-[var(--purple)] text-[var(--text)] bg-[var(--panel)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <History className="w-3 h-3 text-[var(--purple)]" />
            <span>HISTORIAL ({history?.runs.length || 0})</span>
          </button>
        </div>

        <button
          onClick={toggleDownbar}
          className="p-1 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-soft)] rounded"
          title="Cerrar panel inferior"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Cuerpo del Downbar (GraphForge Spec Section 31 — Monospace Terminal Formatting) */}
      <div className="flex-1 overflow-hidden p-2 text-[10.5px] font-mono leading-relaxed">
        {/* Pestaña Consola / Terminal */}
        {activeDownbarTab === 'console' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-0.5 bg-[var(--bg)] p-2 rounded border border-[var(--border-soft)] text-[var(--text)]">
              {consoleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.type === 'cmd'
                      ? 'text-[var(--purple)] font-semibold'
                      : log.type === 'error'
                      ? 'text-[var(--red)]'
                      : 'text-[var(--muted)] whitespace-pre-wrap'
                  }
                >
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            <form onSubmit={handleConsoleSubmit} className="mt-1 flex items-center space-x-2">
              <span className="text-[var(--purple)] font-bold text-xs pl-1">$ saac&gt;</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="Ingresar comando (ej: help, analyze)..."
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[10.5px] text-[var(--text)] px-2 py-0.5 rounded focus:outline-none focus:border-[var(--purple)] font-mono placeholder:text-[var(--muted-2)]"
              />
              <button
                type="submit"
                className="p-1 bg-[var(--purple-soft)] hover:bg-[var(--purple)] hover:text-white text-[var(--purple)] border border-[var(--purple-border)] rounded transition"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        )}

        {/* Pestaña Output */}
        {activeDownbarTab === 'output' && (
          <div className="h-full overflow-y-auto space-y-1 text-[var(--muted)] p-1">
            {lastAnalysisResult ? (
              <div>
                <p className="text-[var(--green)] font-bold">
                  ✓ [ANÁLISIS COMPLETADO] Duración: {lastAnalysisResult.durationMs} ms | Archivos: {lastAnalysisResult.totalFiles} (Éxito: {lastAnalysisResult.successful}, Omitidos: {lastAnalysisResult.skipped})
                </p>
                {lastAnalysisResult.outcomes.map((out, idx) => (
                  <div key={idx} className="text-[10px] text-[var(--muted-2)]">
                    [{out.status}] {out.filePath} {out.errorMessage && `- Error: ${out.errorMessage}`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--muted-2)] italic">No hay registros de análisis recientes.</p>
            )}
          </div>
        )}

        {/* Pestaña Problemas */}
        {activeDownbarTab === 'problems' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {amg?.antipatterns.map((anti) => (
              <div
                key={anti.id}
                className="p-1.5 rounded bg-[var(--panel-2)] border border-[var(--yellow)]/40 text-[var(--yellow)] flex items-center justify-between text-[10px]"
              >
                <span>[{anti.severity.toUpperCase()}] {anti.name}: {anti.description}</span>
                <span className="text-[9px] text-[var(--muted)]">Afectados: {anti.affectedModuleIds.length}</span>
              </div>
            )) || <p className="text-[var(--muted-2)] italic">No se detectaron problemas arquitectónicos.</p>}
          </div>
        )}

        {/* Pestaña Historial */}
        {activeDownbarTab === 'history' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {!history || history.runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-center text-[var(--muted-2)]">
                <p className="italic">Sin historial de corridas en esta sesión.</p>
              </div>
            ) : (
              history.runs.map((run, idx) => (
                <div
                  key={run.runId || idx}
                  className="p-1.5 rounded bg-[var(--panel-2)] border border-[var(--border)] flex items-center justify-between text-[var(--text)] text-[10px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[var(--purple)]">#{run.runId}</span>
                    <span className="text-[var(--muted-2)]">{run.timestamp}</span>
                    <span className="text-[var(--muted)]">({run.totalFiles} archivos, {run.moduleCount} mód)</span>
                  </div>
                  <div className="font-mono text-[var(--purple)] font-bold">
                    Fitness: {run.fitnessScore}/100 ({run.durationMs} ms)
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </footer>
  );
};
