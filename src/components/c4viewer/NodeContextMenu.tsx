import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileCode,
  Gauge,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { C4Node, Module } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';

interface NodeContextMenuProps {
  node: C4Node;
  position?: { x: number; y: number };
  onClose: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  node,
  position,
  onClose,
}) => {
  const { amg } = useProjectStore();

  // Find associated module if available
  const matchingModule: Module | undefined = amg?.modules.find(
    (m) => m.id === node.amgNodeId || m.id === node.id || node.id.startsWith(m.id)
  );

  // Find antipatterns affecting this module
  const antipatterns = (amg?.antipatterns || []).filter(
    (ap) =>
      ap.affectedModuleIds.includes(node.id) ||
      (node.amgNodeId && ap.affectedModuleIds.includes(node.amgNodeId)) ||
      (matchingModule && ap.affectedModuleIds.includes(matchingModule.id))
  );

  // Find inbound & outbound dependencies
  const moduleId = matchingModule?.id || node.amgNodeId || node.id;
  const inboundDeps = (amg?.dependencies || []).filter((d) => d.target === moduleId);
  const outboundDeps = (amg?.dependencies || []).filter((d) => d.source === moduleId);

  const mi = matchingModule?.metrics.maintainabilityIndex;
  const miColor =
    mi === undefined
      ? '#94a3b8'
      : mi >= 80
        ? '#10b981'
        : mi >= 60
          ? '#f59e0b'
          : '#f43f5e';

  return (
    <div
      className="fixed z-50 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-100 rounded-xl shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: position ? Math.min(position.x, window.innerWidth - 340) : '50%',
        top: position ? Math.min(position.y, window.innerHeight - 450) : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold text-slate-100 truncate">{node.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-700/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
        {/* Basic Metadata */}
        <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 font-mono text-[11px]">
          <div className="flex justify-between text-slate-400">
            <span>Tipo:</span>
            <span className="text-sky-300 font-semibold">{node.elementType}</span>
          </div>
          {node.technology && (
            <div className="flex justify-between text-slate-400">
              <span>Tecnología:</span>
              <span className="text-slate-200">{node.technology}</span>
            </div>
          )}
          {matchingModule && (
            <div className="flex justify-between text-slate-400">
              <span>Líneas (LOC):</span>
              <span className="text-amber-300">{matchingModule.loc}</span>
            </div>
          )}
        </div>

        {/* Antipattern Alert */}
        {antipatterns.length > 0 && (
          <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-700/70 text-rose-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Alerta de Antipatrón ({antipatterns.length})</span>
            </div>
            {antipatterns.map((ap) => (
              <div key={ap.id} className="text-[11px] space-y-0.5">
                <span className="font-semibold text-rose-100">{ap.name}</span>
                <p className="text-[10px] text-rose-300/90">{ap.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Metrics Grid */}
        {matchingModule && (
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" /> Métricas del Módulo
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">Mantenibilidad (MI)</span>
                <span className="font-bold font-mono text-sm" style={{ color: miColor }}>
                  {mi?.toFixed(1) ?? 'N/A'} / 100
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">Complejidad (CC Máx)</span>
                <span
                  className={`font-bold font-mono text-sm ${
                    matchingModule.metrics.cyclomaticComplexityMax > 15
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {matchingModule.metrics.cyclomaticComplexityMax}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dependencies (Acoplamiento Inbound & Outbound) */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              Importado por ({inboundDeps.length}):
            </span>
          </div>
          {inboundDeps.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {inboundDeps.map((d, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700/50 truncate max-w-[200px]"
                >
                  {d.source.split('/').pop()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Ningún módulo lo importa</span>
          )}

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
              Importa a ({outboundDeps.length}):
            </span>
          </div>
          {outboundDeps.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {outboundDeps.map((d, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700/50 truncate max-w-[200px]"
                >
                  {d.target.split('/').pop()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 italic">No importa a otros módulos</span>
          )}
        </div>

        {node.description && (
          <div className="p-2 rounded bg-slate-950/40 text-[10px] text-slate-400 border border-slate-800/40">
            {node.description}
          </div>
        )}
      </div>
    </div>
  );
};
