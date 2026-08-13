import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  Key,
  Globe,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Save,
  Sparkles,
} from 'lucide-react';
import { useAiStore } from '../../stores/useAiStore';
import { checkAiStatus } from '../../lib/tauri-api';
import type { AiConfig, AiProvider } from '../../../shared/types';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { setAiStatus } = useAiStore();

  const [provider, setProvider] = useState<AiProvider>('ollama');
  const [endpointUrl, setEndpointUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('qwen2.5-coder');
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Cargar configuración previa guardada en localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('saac_ai_config');
    if (savedConfig) {
      try {
        const parsed: AiConfig = JSON.parse(savedConfig);
        setProvider(parsed.provider);
        setEndpointUrl(parsed.endpointUrl || '');
        setModelName(parsed.modelName || '');
        setApiKey(parsed.apiKey || '');
      } catch (err) {
        console.error('Error cargando configuración IA:', err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Ajustar presets automáticos al cambiar de proveedor
  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    setTestResult(null);

    if (newProvider === 'ollama') {
      setEndpointUrl('http://localhost:11434');
      setModelName('qwen2.5-coder');
      setApiKey('');
    } else if (newProvider === 'open-ai-compatible') {
      // Preset por defecto sugerido para Gemini / OpenAI
      setEndpointUrl('https://generativelanguage.googleapis.com/v1beta/openai');
      setModelName('gemini-1.5-flash');
    } else {
      setEndpointUrl('mock://local');
      setModelName('mock-architect-v1');
      setApiKey('');
    }
  };

  // Preset para Gemini Google AI Studio
  const applyGeminiPreset = () => {
    setProvider('open-ai-compatible');
    setEndpointUrl('https://generativelanguage.googleapis.com/v1beta/openai');
    setModelName('gemini-1.5-flash');
    setTestResult(null);
  };

  // Preset para OpenAI Oficial
  const applyOpenAiPreset = () => {
    setProvider('open-ai-compatible');
    setEndpointUrl('https://api.openai.com/v1');
    setModelName('gpt-4o-mini');
    setTestResult(null);
  };

  // Probar conexión con el servidor/API
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const config: AiConfig = {
      provider,
      endpointUrl,
      modelName,
      apiKey: apiKey.trim() || undefined,
      temperature: 0.2,
      timeoutSeconds: 30,
    };

    try {
      const status = await checkAiStatus(config);
      setAiStatus(status);

      if (status.available || status.provider === 'mock') {
        setTestResult({
          success: true,
          message: status.message || '¡Conexión exitosa con el proveedor de IA!',
        });
      } else {
        setTestResult({
          success: false,
          message: status.message || 'No se pudo conectar al endpoint configurado.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Error de conexión: ${err.toString()}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Guardar configuración
  const handleSave = () => {
    const config: AiConfig = {
      provider,
      endpointUrl,
      modelName,
      apiKey: apiKey.trim() || undefined,
      temperature: 0.2,
      timeoutSeconds: 30,
    };

    localStorage.setItem('saac_ai_config', JSON.stringify(config));
    handleTestConnection();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm font-sans select-none animate-in fade-in duration-150">
      <div className="w-[460px] bg-[#101318] border border-[#252B34] text-[#E6E9ED] rounded-xl shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0B0D10] border-b border-[#252B34]">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[#8B7CFF]" />
            <span className="font-bold text-xs text-[#E6E9ED]">
              Configuración de Inteligencia Artificial (IA)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#858C98] hover:text-[#E6E9ED] rounded hover:bg-[#171B21] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6671]">
              Presets Rápidos
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('ollama')}
                className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                  provider === 'ollama'
                    ? 'bg-[#211E39] border-[#302C51] text-[#8B7CFF]'
                    : 'bg-[#13171D] border-[#1D222A] text-[#858C98] hover:text-[#E6E9ED]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Ollama (Local)</span>
              </button>

              <button
                type="button"
                onClick={applyGeminiPreset}
                className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                  provider === 'open-ai-compatible' && endpointUrl.includes('generativelanguage')
                    ? 'bg-[#211E39] border-[#302C51] text-[#45C8DF]'
                    : 'bg-[#13171D] border-[#1D222A] text-[#858C98] hover:text-[#E6E9ED]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#45C8DF]" />
                <span>Google Gemini API</span>
              </button>

              <button
                type="button"
                onClick={applyOpenAiPreset}
                className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                  provider === 'open-ai-compatible' && endpointUrl.includes('openai.com')
                    ? 'bg-[#211E39] border-[#302C51] text-[#4FD49A]'
                    : 'bg-[#13171D] border-[#1D222A] text-[#858C98] hover:text-[#E6E9ED]'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-[#4FD49A]" />
                <span>OpenAI / Otro</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 bg-[#13171D] p-3 rounded-lg border border-[#1D222A]">
            {/* Endpoint URL */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#858C98] flex items-center justify-between">
                <span>URL del Endpoint / Server:</span>
                {endpointUrl.includes('generativelanguage') && (
                  <span className="text-[#45C8DF] font-mono text-[9px]">Google Gemini OpenAI Compatible</span>
                )}
              </label>
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                className="w-full bg-[#0B0D10] text-[11px] text-[#E6E9ED] px-2.5 py-1.5 rounded border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] font-mono"
              />
            </div>

            {/* Model Name */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#858C98]">Nombre del Modelo:</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="gemini-1.5-flash / qwen2.5-coder / gpt-4o-mini"
                className="w-full bg-[#0B0D10] text-[11px] text-[#E6E9ED] px-2.5 py-1.5 rounded border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] font-mono"
              />
            </div>

            {/* API Key */}
            {provider === 'open-ai-compatible' && (
              <div className="space-y-1">
                <label className="text-[10px] text-[#858C98] flex items-center gap-1">
                  <Key className="w-3 h-3 text-[#E7B85B]" />
                  <span>API Key (Requerido para Gemini / OpenAI cloud):</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0B0D10] text-[11px] text-[#E6E9ED] px-2.5 py-1.5 rounded border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] font-mono"
                />
              </div>
            )}
          </div>

          {/* Test Status Box */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-[#4FD49A]/10 border-[#4FD49A]/30 text-[#4FD49A]'
                  : 'bg-[#EF6B73]/10 border-[#EF6B73]/30 text-[#EF6B73]'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0B0D10] border-t border-[#252B34]">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-3 py-1.5 rounded bg-[#13171D] hover:bg-[#171C23] text-[#E6E9ED] border border-[#252B34] font-semibold text-[11px] transition disabled:opacity-40"
          >
            {isTesting ? 'Probando conexión...' : 'Probar Conexión'}
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[#858C98] hover:text-[#E6E9ED] text-[11px] transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-[#211E39] hover:bg-[#2c284e] text-[#8B7CFF] border border-[#302C51] font-semibold text-[11px] flex items-center space-x-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
