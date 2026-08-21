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
      ? 'var(--muted-2)'
      : mi >= 80
        ? 'var(--green)'
        : mi >= 60
          ? 'var(--yellow)'
          : 'var(--red)';

  return (
    <div
      className="fixed z-50 w-80 bg-[var(--panel)]/95 backdrop-blur-md border border-[var(--border)] text-[var(--text)] rounded-xl shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150 font-sans"
      style={{
        left: position ? Math.min(position.x, window.innerWidth - 340) : '50%',
        top: position ? Math.min(position.y, window.innerHeight - 450) : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--panel-2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-[var(--cyan)] shrink-0" />
          <span className="font-bold text-[var(--text)] truncate">{node.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded hover:bg-[var(--border-soft)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
        {/* Basic Metadata */}
        <div className="space-y-1 bg-[var(--bg)] p-2 rounded-lg border border-[var(--border-soft)] font-mono text-[11px]">
          <div className="flex justify-between text-[var(--muted)]">
            <span>Tipo:</span>
            <span className="text-[var(--cyan)] font-semibold">{node.elementType}</span>
          </div>
          {node.technology && (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Tecnología:</span>
              <span className="text-[var(--text)]">{node.technology}</span>
            </div>
          )}
          {matchingModule && (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Líneas (LOC):</span>
              <span className="text-[var(--yellow)]">{matchingModule.loc}</span>
            </div>
          )}
        </div>

        {/* Antipattern Alert */}
        {antipatterns.length > 0 && (
          <div className="p-2.5 rounded-lg bg-[var(--red)]/15 border border-[var(--red)]/40 text-[var(--red)] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-[var(--red)] shrink-0" />
              <span>Alerta de Antipatrón ({antipatterns.length})</span>
            </div>
            {antipatterns.map((ap) => (
              <div key={ap.id} className="text-[11px] space-y-0.5">
                <span className="font-semibold text-[var(--text)]">{ap.name}</span>
                <p className="text-[10px] text-[var(--muted)]">{ap.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Metrics Grid */}
        {matchingModule && (
          <div className="space-y-1.5">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-[var(--cyan)]" /> Métricas del Módulo
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-[var(--panel-2)] border border-[var(--border-soft)] flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--muted)]">Mantenibilidad (MI)</span>
                <span className="font-bold font-mono text-sm" style={{ color: miColor }}>
                  {mi?.toFixed(1) ?? 'N/A'} / 100
                </span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--panel-2)] border border-[var(--border-soft)] flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--muted)]">Complejidad (CC Máx)</span>
                <span
                  className={`font-bold font-mono text-sm ${
                    matchingModule.metrics.cyclomaticComplexityMax > 15
                      ? 'text-[var(--red)]'
                      : 'text-[var(--green)]'
                  }`}
                >
                  {matchingModule.metrics.cyclomaticComplexityMax}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dependencies (Acoplamiento Inbound & Outbound) */}
        <div className="space-y-2 pt-1 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--muted)] flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--green)]" />
              Importado por ({inboundDeps.length}):
            </span>
          </div>
          {inboundDeps.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {inboundDeps.map((d, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[10px] text-[var(--text)] font-mono border border-[var(--border-soft)] truncate max-w-[200px]"
                >
                  {d.source.split('/').pop()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-[var(--muted-2)] italic">Ningún módulo lo importa</span>
          )}

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-[var(--muted)] flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--cyan)]" />
              Importa a ({outboundDeps.length}):
            </span>
          </div>
          {outboundDeps.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {outboundDeps.map((d, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[10px] text-[var(--text)] font-mono border border-[var(--border-soft)] truncate max-w-[200px]"
                >
                  {d.target.split('/').pop()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-[var(--muted-2)] italic">No importa a otros módulos</span>
          )}
        </div>

        {node.description && (
          <div className="p-2 rounded bg-[var(--bg)] text-[10px] text-[var(--muted)] border border-[var(--border-soft)]">
            {node.description}
          </div>
        )}
      </div>
    </div>
  );
};
