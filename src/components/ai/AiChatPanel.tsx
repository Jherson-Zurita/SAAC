import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Download,
  Sparkles,
  User,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { useAiStore } from '../../stores/useAiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { askAi } from '../../lib/tauri-api';
import { parseSlashCommand, AVAILABLE_SLASH_COMMANDS } from '../../lib/slash-commands';
import { AiStatusIndicator } from './AiStatusIndicator';
import { AiSettingsModal } from './AiSettingsModal';
import { MarkdownRenderer } from './MarkdownRenderer';

export const AiChatPanel: React.FC = () => {
  const { messages, isThinking, addMessage, setIsThinking, clearChat } = useAiStore();
  const { amg } = useProjectStore();
  const { selectedId } = useSelectionStore();

  const [input, setInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    <div className="flex-1 flex flex-col bg-[#0B0D10] h-full overflow-hidden select-none font-sans">
      {/* Header del Chat */}
      <div className="flex items-center justify-between p-3 bg-[#101318] border-b border-[#252B34]">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-[#8B7CFF]" />
          <div>
            <h3 className="text-xs font-bold text-[#E6E9ED]">Asistente Arquitectónico IA</h3>
            <p className="text-[10px] text-[#858C98]">Consultas contextuales del proyecto</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <AiStatusIndicator compact />
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded bg-[#13171D] hover:bg-[#171C23] text-[#858C98] hover:text-[#E6E9ED] border border-[#1D222A] transition"
            title="Configurar Proveedor de IA (Ollama / Gemini / OpenAI)"
          >
            <Settings className="w-3.5 h-3.5 text-[#8B7CFF]" />
          </button>
          <button
            onClick={exportChatMarkdown}
            disabled={messages.length === 0}
            className="p-1.5 rounded bg-[#13171D] hover:bg-[#171C23] text-[#858C98] hover:text-[#E6E9ED] border border-[#1D222A] transition disabled:opacity-40"
            title="Exportar chat a Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="p-1.5 rounded bg-[#13171D] hover:bg-[#171C23] text-[#858C98] hover:text-[#EF6B73] border border-[#1D222A] transition disabled:opacity-40"
            title="Limpiar conversación"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Lista de Mensajes del Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#5F6671] space-y-3">
            <Sparkles className="w-10 h-10 text-[#8B7CFF]/40" />
            <p className="font-semibold text-[#E6E9ED]">¿En qué puedo ayudarte con la arquitectura?</p>
            <p className="text-[11px] text-[#858C98] max-w-xs">
              Usa comandos como <code className="text-[#45C8DF] font-mono">/explain</code>,{' '}
              <code className="text-[#E7B85B] font-mono">/refactor</code> o pregúntame directamente sobre el código.
            </p>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md pt-2 text-left">
              <button
                onClick={() => handleSend('/explain')}
                className="p-2.5 rounded-md bg-[#101318] hover:bg-[#13171D] border border-[#1D222A] hover:border-[#45C8DF]/40 transition text-[#C8CCD4]"
              >
                <span className="font-mono text-[#45C8DF] font-bold text-[11px] block">/explain</span>
                <span className="text-[10px] text-[#858C98]">Explicar módulo seleccionado</span>
              </button>
              <button
                onClick={() => handleSend('/refactor')}
                className="p-2.5 rounded-md bg-[#101318] hover:bg-[#13171D] border border-[#1D222A] hover:border-[#E7B85B]/40 transition text-[#C8CCD4]"
              >
                <span className="font-mono text-[#E7B85B] font-bold text-[11px] block">/refactor</span>
                <span className="text-[10px] text-[#858C98]">Sugerir refactorización</span>
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
                <div className="p-1.5 rounded-md bg-[#211E39] border border-[#302C51] text-[#8B7CFF] shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`rounded-lg p-3 space-y-1 ${
                  m.sender === 'user'
                    ? 'max-w-[75%] bg-[#211E39] text-[#E6E9ED] border border-[#302C51] rounded-tr-none'
                    : 'max-w-[90%] bg-[#101318] text-[#C8CCD4] border border-[#1D222A] rounded-tl-none'
                }`}
              >
                {/* Header del mensaje del asistente */}
                {m.sender === 'assistant' && (
                  <div className="flex items-center justify-between border-b border-[#1D222A] pb-1 mb-1.5">
                    <span className="text-[10px] font-bold text-[#8B7CFF]">IA SAAC</span>
                    {m.isMockFallback && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#E7B85B]/10 text-[#E7B85B] border border-[#E7B85B]/20 flex items-center space-x-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>Mock Fallback</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Markdown rendering for assistant, plain text for user */}
                {m.sender === 'assistant' ? (
                  <div className="saac-markdown-body">
                    <MarkdownRenderer content={m.text} />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed text-[11.5px]">{m.text}</div>
                )}

                <div className="flex items-center justify-end space-x-2 text-[9px] text-[#5F6671] font-mono pt-1">
                  <span>{m.timestamp}</span>
                </div>
              </div>

              {m.sender === 'user' && (
                <div className="p-1.5 rounded-md bg-[#211E39] border border-[#302C51] text-[#8B7CFF] shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex items-center space-x-2 text-[#8B7CFF] text-xs font-mono animate-pulse">
            <Bot className="w-4 h-4" />
            <span>Generando respuesta arquitectónica...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Popover de Menú Slash Commands */}
      {showSlashMenu && (
        <div className="bg-[#101318] border-t border-[#252B34] p-2 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#5F6671] px-2">Comandos Slash Disponibles</span>
          {AVAILABLE_SLASH_COMMANDS.map((sc) => (
            <div
              key={sc.command}
              onClick={() => {
                setInput(sc.command + ' ');
                setShowSlashMenu(false);
              }}
              className="p-1.5 rounded hover:bg-[#13171D] cursor-pointer text-xs flex items-center justify-between text-[#C8CCD4] hover:text-[#E6E9ED] transition"
            >
              <span className="font-mono text-[#45C8DF] font-bold">{sc.command}</span>
              <span className="text-[10px] text-[#858C98]">{sc.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input de Envío */}
      <div className="p-3 bg-[#101318] border-t border-[#252B34]">
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
            className="flex-1 bg-[#0B0D10] text-xs text-[#E6E9ED] px-3 py-2 rounded-md border border-[#252B34] focus:outline-none focus:border-[#8B7CFF] font-sans placeholder:text-[#5F6671]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="p-2 bg-[#211E39] hover:bg-[#2c284e] text-[#8B7CFF] rounded-md border border-[#302C51] disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
