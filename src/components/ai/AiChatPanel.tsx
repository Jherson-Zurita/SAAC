import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Download,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react';
import { useAiStore } from '../../stores/useAiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { askAi } from '../../lib/tauri-api';
import { parseSlashCommand, AVAILABLE_SLASH_COMMANDS } from '../../lib/slash-commands';
import { AiStatusIndicator } from './AiStatusIndicator';

export const AiChatPanel: React.FC = () => {
  const { messages, isThinking, addMessage, setIsThinking, clearChat } = useAiStore();
  const { amg } = useProjectStore();
  const { selectedId } = useSelectionStore();

  const [input, setInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isThinking) return;

    setInput('');
    setShowSlashMenu(false);

    // 1. Parsear comandos slash
    const parsed = parseSlashCommand(query, selectedId);

    // 2. Agregar mensaje de usuario
    addMessage('user', query);
    setIsThinking(true);

    try {
      // 3. Invocar ask_ai en el backend de Rust
      const response = await askAi(
        parsed.prompt,
        parsed.contextType,
        parsed.targetId,
        amg || undefined
      );

      // 4. Agregar respuesta del asistente
      addMessage('assistant', response.answer, {
        isMockFallback: true, // Siempre marcado adecuadamente si es fallback local
        tokensUsed: response.tokensUsed,
      });
    } catch (err) {
      console.error('Error invocando IA:', err);
      addMessage(
        'assistant',
        `⚠️ Error al procesar la solicitud de IA: ${err}`
      );
    } finally {
      setIsThinking(false);
    }
  };

  // Exportar conversación a Markdown
  const exportChatMarkdown = () => {
    if (messages.length === 0) return;

    let content = `# SAAC v2.0 — Transcript de Asistente IA\n`;
    content += `*Fecha:* ${new Date().toLocaleString()}\n`;
    content += `*Proyecto:* ${amg?.projectName || 'Sin proyecto'}\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.sender === 'user' ? '👤 **Usuario**' : '🤖 **Asistente SAAC**';
      content += `### ${sender} _(${m.timestamp})_\n\n${m.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saac_chat_${Date.now()}.md`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0d0f17] h-full overflow-hidden select-none">
      {/* Header del Chat */}
      <div className="flex items-center justify-between p-3 bg-[#121520] border-b border-[#1e2333]">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-xs font-bold text-gray-200">Asistente Arquitectónico IA</h3>
            <p className="text-[10px] text-gray-400">Consultas contextuales del proyecto</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <AiStatusIndicator compact />
          <button
            onClick={exportChatMarkdown}
            disabled={messages.length === 0}
            className="p-1.5 rounded bg-[#161a26] hover:bg-[#1f2638] text-gray-400 hover:text-white border border-[#232a3e] transition disabled:opacity-40"
            title="Exportar chat a Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="p-1.5 rounded bg-[#161a26] hover:bg-[#1f2638] text-gray-400 hover:text-rose-400 border border-[#232a3e] transition disabled:opacity-40"
            title="Limpiar conversación"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lista de Mensajes del Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-3">
            <Sparkles className="w-10 h-10 text-cyan-400/40" />
            <p className="font-semibold text-gray-300">¿En qué puedo ayudarte con la arquitectura?</p>
            <p className="text-[11px] text-gray-500 max-w-xs">
              Usa comandos como <code className="text-cyan-400 font-mono">/explain</code>,{' '}
              <code className="text-amber-400 font-mono">/refactor</code> o pregúntame directamente sobre el código.
            </p>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md pt-2 text-left">
              <button
                onClick={() => handleSend('/explain')}
                className="p-2.5 rounded-lg bg-[#121520] hover:bg-[#161a26] border border-[#1e2333] hover:border-cyan-500/40 transition text-gray-300"
              >
                <span className="font-mono text-cyan-400 font-bold text-[11px] block">/explain</span>
                <span className="text-[10px] text-gray-400">Explicar módulo seleccionado</span>
              </button>
              <button
                onClick={() => handleSend('/refactor')}
                className="p-2.5 rounded-lg bg-[#121520] hover:bg-[#161a26] border border-[#1e2333] hover:border-amber-500/40 transition text-gray-300"
              >
                <span className="font-mono text-amber-400 font-bold text-[11px] block">/refactor</span>
                <span className="text-[10px] text-gray-400">Sugerir refactorización</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start space-x-2.5 ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'assistant' && (
                <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl p-3 space-y-1 ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-[#121520] text-gray-200 border border-[#1e2333] rounded-tl-none'
                }`}
              >
                {/* Header del mensaje del asistente */}
                {m.sender === 'assistant' && (
                  <div className="flex items-center justify-between border-b border-[#1e2333] pb-1 mb-1">
                    <span className="text-[10px] font-bold text-cyan-400">IA SAAC</span>
                    {m.isMockFallback && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>Mock Fallback</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

                <div className="flex items-center justify-end space-x-2 text-[9px] text-gray-500 font-mono pt-1">
                  <span>{m.timestamp}</span>
                </div>
              </div>

              {m.sender === 'user' && (
                <div className="p-1.5 rounded-lg bg-blue-900/60 border border-blue-500/30 text-blue-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono animate-pulse">
            <Bot className="w-4 h-4" />
            <span>Generando respuesta arquitectónica...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Popover de Menú Slash Commands */}
      {showSlashMenu && (
        <div className="bg-[#121520] border-t border-[#1e2333] p-2 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 px-2">Comandos Slash Disponibles</span>
          {AVAILABLE_SLASH_COMMANDS.map((sc) => (
            <div
              key={sc.command}
              onClick={() => {
                setInput(sc.command + ' ');
                setShowSlashMenu(false);
              }}
              className="p-1.5 rounded hover:bg-[#161a26] cursor-pointer text-xs flex items-center justify-between text-gray-300 hover:text-white transition"
            >
              <span className="font-mono text-cyan-400 font-bold">{sc.command}</span>
              <span className="text-[10px] text-gray-400">{sc.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input de Envío */}
      <div className="p-3 bg-[#121520] border-t border-[#1e2333]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Pregunte a la IA o escriba / para comandos slash..."
            value={input}
            onChange={handleInputChange}
            disabled={isThinking}
            className="flex-1 bg-[#090b10] text-xs text-gray-200 px-3 py-2 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500 font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg disabled:opacity-40 transition shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
