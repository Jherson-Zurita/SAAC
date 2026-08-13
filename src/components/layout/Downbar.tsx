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
    <footer className="h-[166px] bg-[#101318] border-t border-[#252B34] flex flex-col select-none z-10 font-sans shrink-0">
      {/* Header de pestañas (GraphForge Spec Section 30) */}
      <div className="h-[32px] px-3 border-b border-[#252B34] flex items-center justify-between bg-[#0B0D10]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveDownbarTab('console')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'console'
                ? 'border-[#8B7CFF] text-[#E6E9ED] bg-[#101318]'
                : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
            }`}
          >
            <TerminalIcon className="w-3 h-3 text-[#8B7CFF]" />
            <span>TERMINAL</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('problems')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'problems'
                ? 'border-[#8B7CFF] text-[#E6E9ED] bg-[#101318]'
                : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-[#E7B85B]" />
            <span>PROBLEMAS ({amg?.antipatterns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('output')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'output'
                ? 'border-[#8B7CFF] text-[#E6E9ED] bg-[#101318]'
                : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
            }`}
          >
            <FileText className="w-3 h-3 text-[#45C8DF]" />
            <span>OUTPUT</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('history')}
            className={`px-3 h-[32px] text-[10px] font-semibold tracking-wider flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'history'
                ? 'border-[#8B7CFF] text-[#E6E9ED] bg-[#101318]'
                : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
            }`}
          >
            <History className="w-3 h-3 text-[#8B7CFF]" />
            <span>HISTORIAL ({history?.runs.length || 0})</span>
          </button>
        </div>

        <button
          onClick={toggleDownbar}
          className="p-1 text-[#858C98] hover:text-[#E6E9ED] hover:bg-[#171B21] rounded"
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
            <div className="flex-1 overflow-y-auto space-y-0.5 bg-[#0B0D10] p-2 rounded border border-[#1D222A] text-[#E6E9ED]">
              {consoleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.type === 'cmd'
                      ? 'text-[#8B7CFF] font-semibold'
                      : log.type === 'error'
                      ? 'text-[#EF6B73]'
                      : 'text-[#858C98] whitespace-pre-wrap'
                  }
                >
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            <form onSubmit={handleConsoleSubmit} className="mt-1 flex items-center space-x-2">
              <span className="text-[#8B7CFF] font-bold text-xs pl-1">$ saac&gt;</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="Ingresar comando (ej: help, analyze)..."
                className="flex-1 bg-[#0B0D10] border border-[#252B34] text-[10.5px] text-[#E6E9ED] px-2 py-0.5 rounded focus:outline-none focus:border-[#8B7CFF] font-mono placeholder-[#5F6671]"
              />
              <button
                type="submit"
                className="p-1 bg-[#211E39] hover:bg-[#2c284e] text-[#8B7CFF] border border-[#302C51] rounded"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        )}

        {/* Pestaña Output */}
        {activeDownbarTab === 'output' && (
          <div className="h-full overflow-y-auto space-y-1 text-[#858C98] p-1">
            {lastAnalysisResult ? (
              <div>
                <p className="text-[#4FD49A] font-bold">
                  ✓ [ANÁLISIS COMPLETADO] Duración: {lastAnalysisResult.durationMs} ms | Archivos: {lastAnalysisResult.totalFiles} (Éxito: {lastAnalysisResult.successful}, Omitidos: {lastAnalysisResult.skipped})
                </p>
                {lastAnalysisResult.outcomes.map((out, idx) => (
                  <div key={idx} className="text-[10px] text-[#5F6671]">
                    [{out.status}] {out.filePath} {out.errorMessage && `- Error: ${out.errorMessage}`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#5F6671] italic">No hay registros de análisis recientes.</p>
            )}
          </div>
        )}

        {/* Pestaña Problemas */}
        {activeDownbarTab === 'problems' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {amg?.antipatterns.map((anti) => (
              <div
                key={anti.id}
                className="p-1.5 rounded bg-[#13171D] border border-[#E7B85B]/40 text-[#E7B85B] flex items-center justify-between text-[10px]"
              >
                <span>[{anti.severity.toUpperCase()}] {anti.name}: {anti.description}</span>
                <span className="text-[9px] text-[#858C98]">Afectados: {anti.affectedModuleIds.length}</span>
              </div>
            )) || <p className="text-[#5F6671] italic">No se detectaron problemas arquitectónicos.</p>}
          </div>
        )}

        {/* Pestaña Historial */}
        {activeDownbarTab === 'history' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {!history || history.runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-center text-[#5F6671]">
                <p className="italic">Sin historial de corridas en esta sesión.</p>
              </div>
            ) : (
              history.runs.map((run, idx) => (
                <div
                  key={run.runId || idx}
                  className="p-1.5 rounded bg-[#13171D] border border-[#252B34] flex items-center justify-between text-[#E6E9ED] text-[10px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#8B7CFF]">#{run.runId}</span>
                    <span className="text-[#5F6671]">{run.timestamp}</span>
                    <span className="text-[#858C98]">({run.totalFiles} archivos, {run.moduleCount} mód)</span>
                  </div>
                  <div className="font-mono text-[#8B7CFF] font-bold">
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
