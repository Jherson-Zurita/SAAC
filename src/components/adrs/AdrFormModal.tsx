import React, { useState } from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { addAdr } from '../../lib/tauri-api';
import type { Adr } from '../../../shared/types';

interface AdrFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextNumber: number;
}

export const AdrFormModal: React.FC<AdrFormModalProps> = ({
  isOpen,
  onClose,
  nextNumber,
}) => {
  const { projectPath, setAnnotations } = useProjectStore();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Adr['status']>('Accepted');
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');
  const [author, setAuthor] = useState('Arquitecto de Software');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPath || !title.trim() || !decision.trim()) return;

    setIsSubmitting(true);
    try {
      const newAdr: Adr = {
        id: `adr-${Date.now()}`,
        number: nextNumber,
        title: title.trim(),
        status,
        context: context.trim() || 'No especificado.',
        decision: decision.trim(),
        consequences: consequences.trim() || 'No especificado.',
        date: new Date().toISOString().split('T')[0],
        author: author.trim() || 'Usuario',
      };

      const updatedAnnotations = await addAdr(projectPath, newAdr);
      setAnnotations(updatedAnnotations);
      onClose();

      // Reset form
      setTitle('');
      setContext('');
      setDecision('');
      setConsequences('');
    } catch (err) {
      console.error('Error al guardar ADR:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121520] border border-[#1e2333] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#0d0f16] border-b border-[#1e2333] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-gray-100">
              Registrar Nueva Decisión Arquitectónica (ADR-{String(nextNumber).padStart(4, '0')})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1f2638]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Título & Estado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="block text-[11px] font-semibold text-gray-300">
                Título de la Decisión <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Adopción de Arquitectura Hexagonal en backend..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-300">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Adr['status'])}
                className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="Accepted">Aceptado</option>
                <option value="Proposed">Propuesto</option>
                <option value="Rejected">Rechazado</option>
                <option value="Deprecated">Obsoleto</option>
                <option value="Superseded">Reemplazado</option>
              </select>
            </div>
          </div>

          {/* Contexto y Problema */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">
              Contexto &amp; Problema
            </label>
            <textarea
              rows={3}
              placeholder="¿Qué problema técnico o requerimiento motivó esta decisión?"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Decisión Tomada */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">
              Decisión Tomada <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="¿Qué cambio de diseño o arquitectura se decidió implementar?"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Consecuencias */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">
              Consecuencias &amp; Impacto (Positivo / Negativo)
            </label>
            <textarea
              rows={3}
              placeholder="¿Cuáles son los beneficios, costos o trade-offs esperados?"
              value={consequences}
              onChange={(e) => setConsequences(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Autor */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">Autor / Firma</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#1e2333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !decision.trim()}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-40 flex items-center space-x-1.5 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar ADR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
