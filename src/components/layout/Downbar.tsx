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
    { text: 'SAAC Console v2.0 initialized. Type "help" for commands.', type: 'output' },
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
    <footer className="h-56 bg-[#12151e] border-t border-[#232838] flex flex-col select-none z-10">
      {/* Header de pestañas */}
      <div className="h-9 px-3 border-b border-[#232838] flex items-center justify-between bg-[#0d0f16]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveDownbarTab('output')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'output'
                ? 'border-blue-500 text-blue-400 bg-[#161a26]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('problems')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'problems'
                ? 'border-amber-500 text-amber-400 bg-[#161a26]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Problemas ({amg?.antipatterns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('history')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'history'
                ? 'border-purple-500 text-purple-400 bg-[#161a26]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({history?.runs.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveDownbarTab('console')}
            className={`px-3 py-1.5 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition ${
              activeDownbarTab === 'console'
                ? 'border-cyan-500 text-cyan-400 bg-[#161a26]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Consola SAAC</span>
          </button>
        </div>

        <button
          onClick={toggleDownbar}
          className="p-1 text-gray-400 hover:text-white hover:bg-[#1f2433] rounded"
          title="Cerrar panel inferior"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cuerpo del Downbar */}
      <div className="flex-1 overflow-hidden p-2 text-xs font-mono">
        {/* Pestaña Output */}
        {activeDownbarTab === 'output' && (
          <div className="h-full overflow-y-auto space-y-1 text-gray-300 p-1">
            {lastAnalysisResult ? (
              <div>
                <p className="text-emerald-400 font-bold">
                  [ANÁLISIS COMPLETADO] Duración: {lastAnalysisResult.durationMs} ms | Archivos: {lastAnalysisResult.totalFiles} (Éxito: {lastAnalysisResult.successful}, Saltados: {lastAnalysisResult.skipped})
                </p>
                {lastAnalysisResult.outcomes.map((out, idx) => (
                  <div key={idx} className="text-[11px] text-gray-400">
                    [{out.status}] {out.filePath} {out.errorMessage && `- Error: ${out.errorMessage}`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No hay logs de análisis recientes. Inicie un análisis.</p>
            )}
          </div>
        )}

        {/* Pestaña Problems */}
        {activeDownbarTab === 'problems' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {amg?.antipatterns.map((anti) => (
              <div
                key={anti.id}
                className="p-1.5 rounded bg-[#18151f] border border-amber-500/20 text-amber-300 flex items-center justify-between"
              >
                <span>[{anti.severity.toUpperCase()}] {anti.name}: {anti.description}</span>
                <span className="text-[10px] text-gray-400">Afectados: {anti.affectedModuleIds.length}</span>
              </div>
            )) || <p className="text-gray-500 italic">No se detectaron problemas en el modelo actual.</p>}
          </div>
        )}

        {/* Pestaña History */}
        {activeDownbarTab === 'history' && (
          <div className="h-full overflow-y-auto space-y-1 p-1">
            {history?.runs.map((run) => (
              <div
                key={run.runId}
                className="p-2 rounded bg-[#141724] border border-[#232838] flex items-center justify-between text-gray-300"
              >
                <div>
                  <span className="font-bold text-blue-400">{run.runId}</span> - {run.timestamp}
                  <div className="text-[10px] text-gray-400">
                    Archivos: {run.totalFiles} | Módulos: {run.moduleCount} | Antipatrones: {run.antipatternCount}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-emerald-400 font-bold">FS: {run.fitnessScore}</span>
                  <div className="text-[10px] text-gray-500">{run.durationMs} ms</div>
                </div>
              </div>
            )) || <p className="text-gray-500 italic">Sin historial de ejecuciones guardado.</p>}
          </div>
        )}

        {/* Pestaña Consola SAAC */}
        {activeDownbarTab === 'console' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-1 bg-[#090b10] p-2 rounded border border-[#1b1f2c] text-gray-200">
              {consoleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.type === 'cmd'
                      ? 'text-cyan-400 font-bold'
                      : log.type === 'error'
                      ? 'text-rose-400 font-semibold'
                      : 'text-gray-300 whitespace-pre-wrap'
                  }
                >
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            <form onSubmit={handleConsoleSubmit} className="mt-1 flex items-center space-x-2">
              <span className="text-cyan-400 font-bold text-xs pl-1">saac&gt;</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="Escriba un comando (ej: help, analyze, rules check)..."
                className="flex-1 bg-[#090a0f] border border-[#232838] text-xs text-gray-200 px-2 py-1 rounded focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="submit"
                className="p-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </footer>
  );
};
