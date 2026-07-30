import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { addRisk } from '../../lib/tauri-api';
import type { Risk } from '../../../shared/types';

interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RiskFormModal: React.FC<RiskFormModalProps> = ({ isOpen, onClose }) => {
  const { amg, projectPath, setAnnotations } = useProjectStore();

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Risk['severity']>('High');
  const [description, setDescription] = useState('');
  const [mitigation, setMitigation] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleModuleSelection = (modId: string) => {
    if (selectedModules.includes(modId)) {
      setSelectedModules(selectedModules.filter((id) => id !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPath || !title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const newRisk: Risk = {
        id: `risk-${Date.now()}`,
        title: title.trim(),
        severity,
        description: description.trim(),
        mitigation: mitigation.trim() || 'Monitoreo preventivo.',
        affectedModuleIds: selectedModules,
      };

      const updatedAnnotations = await addRisk(projectPath, newRisk);
      setAnnotations(updatedAnnotations);
      onClose();

      // Reset form
      setTitle('');
      setDescription('');
      setMitigation('');
      setSelectedModules([]);
    } catch (err) {
      console.error('Error al guardar Riesgo:', err);
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
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-gray-100">
              Registrar Nuevo Riesgo Arquitectónico
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
          {/* Título & Severidad */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="block text-[11px] font-semibold text-gray-300">
                Título del Riesgo <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Cuello de botella en capa de persistencia SQL..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-300">Severidad</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Risk['severity'])}
                className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="Critical">Crítico</option>
                <option value="High">Alto</option>
                <option value="Medium">Medio</option>
                <option value="Low">Bajo</option>
              </select>
            </div>
          </div>

          {/* Descripción del Riesgo */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">
              Descripción del Riesgo <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Explique las causas y posibles fallos que este riesgo puede generar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Estrategia de Mitigación */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-gray-300">
              Estrategia de Mitigación Recomendada
            </label>
            <textarea
              rows={3}
              placeholder="¿Qué acciones se deben tomar para mitigar o prevenir el riesgo?"
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
              className="w-full bg-[#090b10] border border-[#1e2333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Módulos Afectados */}
          {amg && amg.modules.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-gray-300">
                Seleccionar Módulos Afectados ({selectedModules.length} seleccionados)
              </label>
              <div className="bg-[#090b10] border border-[#1e2333] rounded-lg p-2 max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                {amg.modules.map((mod) => {
                  const isSelected = selectedModules.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => toggleModuleSelection(mod.id)}
                      className={`px-2 py-1.5 rounded cursor-pointer border transition flex items-center justify-between truncate ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-[#121520] text-gray-400 border-[#1e2333] hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate">{mod.name}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0 ml-1" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-40 flex items-center space-x-1.5 shadow-md"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Riesgo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
