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
      if (status.available || status.isOnline) {
        setTestResult({
          success: true,
          message: `Conexión exitosa con ${String(status.provider).toUpperCase()} (${status.model || 'OK'})`,
        });
      } else {
        setTestResult({
          success: false,
          message: status.message || `No se pudo conectar: proveedor marcado como inactivo o con error`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: `Error de conexión: ${String(err)}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans select-none animate-in fade-in duration-150">
      <div className="w-[460px] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] rounded-xl shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg)] border-b border-[var(--border)]">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[var(--purple)]" />
            <span className="font-bold text-xs text-[var(--text)]">
              Configuración de Inteligencia Artificial (IA)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded hover:bg-[var(--border-soft)] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
              Presets Rápidos
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('ollama')}
                className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                  provider === 'ollama'
                    ? 'bg-[var(--purple-soft)] border-[var(--purple-border)] text-[var(--purple)]'
                    : 'bg-[var(--panel-2)] border-[var(--border-soft)] text-[var(--muted)] hover:text-[var(--text)]'
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
                    ? 'bg-[var(--purple-soft)] border-[var(--purple-border)] text-[var(--cyan)]'
                    : 'bg-[var(--panel-2)] border-[var(--border-soft)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--cyan)]" />
                <span>Google Gemini API</span>
              </button>

              <button
                type="button"
                onClick={applyOpenAiPreset}
                className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition ${
                  provider === 'open-ai-compatible' && endpointUrl.includes('openai.com')
                    ? 'bg-[var(--purple-soft)] border-[var(--purple-border)] text-[var(--green)]'
                    : 'bg-[var(--panel-2)] border-[var(--border-soft)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-[var(--green)]" />
                <span>OpenAI / Otro</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 bg-[var(--panel-2)] p-3 rounded-lg border border-[var(--border-soft)]">
            {/* Endpoint URL */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--muted)] flex items-center justify-between">
                <span>URL del Endpoint / Server:</span>
                {endpointUrl.includes('generativelanguage') && (
                  <span className="text-[var(--cyan)] font-mono text-[9px]">Google Gemini OpenAI Compatible</span>
                )}
              </label>
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--purple)]"
              />
            </div>

            {/* Model Name */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--muted)]">Nombre del Modelo:</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="qwen2.5-coder, gemini-1.5-flash, etc."
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--purple)]"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--muted)] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-[var(--purple)]" /> API Key (Requerido para Cloud REST APIs):
                </span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... o sk-..."
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--purple)] placeholder:text-[var(--muted-2)]"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center space-x-2 ${
                testResult.success
                  ? 'bg-[var(--green)]/10 border-[var(--green)]/30 text-[var(--green)]'
                  : 'bg-[var(--red)]/10 border-[var(--red)]/30 text-[var(--red)]'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="leading-tight">{testResult.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-1.5 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] border border-[var(--border)] transition disabled:opacity-50 font-semibold"
            >
              {isTesting ? 'Probando...' : 'Probar Conexión'}
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-[var(--muted)] hover:text-[var(--text)] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded bg-[var(--purple)] hover:opacity-90 text-white font-bold flex items-center space-x-1.5 transition shadow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
