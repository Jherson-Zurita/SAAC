import React, { useEffect } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { useAiStore } from '../../stores/useAiStore';
import { checkAiStatus } from '../../lib/tauri-api';

export const AiStatusIndicator: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { aiStatus, setAiStatus } = useAiStore();

  const fetchStatus = async () => {
    try {
      const res = await checkAiStatus();
      setAiStatus(res);
    } catch {
      setAiStatus({
        available: false,
        provider: 'mock',
        endpoint: 'none',
        model: 'saac-mock-v1',
        message: 'Modo Offline / Mock Fallback',
      });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isOnline = aiStatus?.available && aiStatus.provider === 'ollama';

  if (compact) {
    return (
      <button
        onClick={fetchStatus}
        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono border transition ${
          isOnline
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
        }`}
        title={`IA Status: ${aiStatus?.message || 'Cargando...'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span>{isOnline ? 'Ollama Online' : 'IA Mock'}</span>
      </button>
    );
  }

  return (
    <div
      onClick={fetchStatus}
      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#161a26] border border-[#232a3e] cursor-pointer hover:border-cyan-500/40 transition select-none text-xs"
    >
      <div className="flex items-center space-x-2">
        <Bot className={`w-4 h-4 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
        <div>
          <span className="font-bold text-gray-200 block text-[11px]">
            {isOnline ? `Ollama (${aiStatus?.model})` : 'Motor IA Local (Mock)'}
          </span>
          <span className="text-[9px] text-gray-400 font-mono block">
            {aiStatus?.message || 'Verificando estado...'}
          </span>
        </div>
      </div>

      <RefreshCw className="w-3.5 h-3.5 text-gray-500 hover:text-gray-200 transition" />
    </div>
  );
};
