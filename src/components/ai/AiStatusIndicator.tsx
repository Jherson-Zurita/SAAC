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

  const isOnline = Boolean(aiStatus?.isOnline || aiStatus?.available);
  const providerLabel =
    aiStatus?.provider === 'open-ai-compatible'
      ? 'API Cloud / Gemini'
      : aiStatus?.provider === 'ollama'
        ? 'Ollama Online'
        : 'IA Mock';

  if (compact) {
    return (
      <button
        onClick={fetchStatus}
        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono border transition ${
          isOnline
            ? 'bg-[#4FD49A]/10 text-[#4FD49A] border-[#4FD49A]/20 hover:bg-[#4FD49A]/20'
            : 'bg-[#E7B85B]/10 text-[#E7B85B] border-[#E7B85B]/20 hover:bg-[#E7B85B]/20'
        }`}
        title={`IA Status: ${aiStatus?.message || 'Cargando...'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#4FD49A] animate-pulse' : 'bg-[#E7B85B]'}`} />
        <span>{providerLabel}</span>
      </button>
    );
  }

  return (
    <div
      onClick={fetchStatus}
      className="flex items-center justify-between px-3 py-1.5 rounded-md bg-[#13171D] border border-[#1D222A] cursor-pointer hover:border-[#8B7CFF]/40 transition select-none text-xs"
    >
      <div className="flex items-center space-x-2">
        <Bot className={`w-4 h-4 ${isOnline ? 'text-[#4FD49A]' : 'text-[#E7B85B]'}`} />
        <div>
          <span className="font-bold text-[#E6E9ED] block text-[11px]">
            {isOnline ? `${providerLabel} (${aiStatus?.model || aiStatus?.endpointUrl || 'Online'})` : 'Motor IA Local (Mock)'}
          </span>
          <span className="text-[9px] text-[#858C98] font-mono block">
            {aiStatus?.message || 'Verificando estado...'}
          </span>
        </div>
      </div>

      <RefreshCw className="w-3.5 h-3.5 text-[#858C98] hover:text-[#E6E9ED] transition" />
    </div>
  );
};
