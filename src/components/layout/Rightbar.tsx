import React, { useState } from 'react';
import {
  X,
  FileCode,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Info,
  Bot,
  Gauge,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { AiChatPanel } from '../ai/AiChatPanel';
import type { Module, Antipattern, ClassInfo } from '../../../shared/types';

export const Rightbar: React.FC = () => {
  const { rightbarOpen } = useUiStore();
  const { selectedId, selectedType, selectedData, clearSelection } = useSelectionStore();
  const { amg, fitnessResult } = useProjectStore();

  const [rightTab, setRightTab] = useState<'inspector' | 'ai'>('inspector');

  if (!rightbarOpen) return null;

  const renderModuleDetails = (module: Module) => {
    const m = module.metrics;
    const miColor =
      m.maintainabilityIndex >= 80
        ? 'var(--green)'
        : m.maintainabilityIndex >= 60
          ? 'var(--yellow)'
          : 'var(--red)';

    // Find inbound & outbound dependencies for this module
    const inboundDeps = (amg?.dependencies || []).filter((d) => d.target === module.id);
    const outboundDeps = (amg?.dependencies || []).filter((d) => d.source === module.id);

    return (
      <div className="space-y-3 font-sans text-xs">
        {/* Module Header Card (GraphForge Spec Section 26) */}
        <div className="bg-[var(--panel-2)] p-2.5 rounded-md border border-[var(--border-soft)] space-y-1">
          <div className="flex items-center space-x-2 text-[var(--purple)] font-semibold text-xs">
            <FileCode className="w-4 h-4 shrink-0" />
            <span className="truncate">{module.name}</span>
          </div>
          <p className="text-[10px] text-[var(--muted-2)] font-mono truncate" title={module.id}>
            {module.id}
          </p>
        </div>

        {/* Section: Properties (GraphForge Spec Section 27 — Two Column Layout) */}
        <div className="space-y-1 bg-[var(--panel-2)] p-2.5 rounded-md border border-[var(--border-soft)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 block">
            Propiedades
          </span>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted)]">Lenguaje</span>
              <span className="text-[var(--cyan)] font-semibold uppercase">{module.language}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted)]">Tipo</span>
              <span className="text-[var(--purple)] font-semibold">{module.moduleType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted)]">Líneas (LOC)</span>
              <span className="text-[var(--text)] font-mono">{module.loc}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted)]">Clases / Func</span>
              <span className="text-[var(--muted)] font-mono">
                {module.classes.length} c / {module.functions.length} f
              </span>
            </div>
          </div>
        </div>

        {/* Section: Metrics (GraphForge Spec Section 28 — Compact 2x2 Grid) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-[var(--purple)]" /> Métricas de Calidad
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-[var(--panel-2)] p-2 rounded-md border border-[var(--border-soft)] flex flex-col gap-0.5">
              <span className="text-[var(--muted-2)]">Mantenibilidad</span>
              <span className="font-bold font-mono text-xs" style={{ color: miColor }}>
                {Math.round(m.maintainabilityIndex)} / 100
              </span>
            </div>

            <div className="bg-[var(--panel-2)] p-2 rounded-md border border-[var(--border-soft)] flex flex-col gap-0.5">
              <span className="text-[var(--muted-2)]">CC Máx</span>
              <span
                className={`font-bold font-mono text-xs ${
                  m.cyclomaticComplexityMax > 15 ? 'text-[var(--red)]' : 'text-[var(--green)]'
                }`}
              >
                {m.cyclomaticComplexityMax}
              </span>
            </div>

            <div className="bg-[var(--panel-2)] p-2 rounded-md border border-[var(--border-soft)] flex flex-col gap-0.5">
              <span className="text-[var(--muted-2)]">Aferente (Ca)</span>
              <span className="font-bold font-mono text-xs text-[var(--cyan)]">{m.ca}</span>
            </div>

            <div className="bg-[var(--panel-2)] p-2 rounded-md border border-[var(--border-soft)] flex flex-col gap-0.5">
              <span className="text-[var(--muted-2)]">Eferente (Ce)</span>
              <span className="font-bold font-mono text-xs text-[var(--purple)]">{m.ce}</span>
            </div>
          </div>
        </div>

        {/* Section: Connections (GraphForge Spec Section 29 — Compact List) */}
        <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
            Conexiones ({inboundDeps.length + outboundDeps.length})
          </span>

          <div className="space-y-1 text-[10px]">
            <div className="flex items-center text-[var(--muted)] gap-1">
              <ArrowDownLeft className="w-3 h-3 text-[var(--green)]" />
              <span>Importado por ({inboundDeps.length}):</span>
            </div>
            {inboundDeps.length > 0 ? (
              <div className="space-y-0.5 max-h-24 overflow-y-auto pl-2">
                {inboundDeps.map((d, i) => (
                  <div
                    key={i}
                    className="p-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] font-mono truncate border border-[var(--border-soft)]"
                  >
                    ● {d.source.split('/').pop()}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[var(--muted-2)] text-[9px] italic pl-2">Ninguno</span>
            )}

            <div className="flex items-center text-[var(--muted)] gap-1 pt-1">
              <ArrowUpRight className="w-3 h-3 text-[var(--cyan)]" />
              <span>Importa a ({outboundDeps.length}):</span>
            </div>
            {outboundDeps.length > 0 ? (
              <div className="space-y-0.5 max-h-24 overflow-y-auto pl-2">
                {outboundDeps.map((d, i) => (
                  <div
                    key={i}
                    className="p-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] font-mono truncate border border-[var(--border-soft)]"
                  >
                    ● {d.target.split('/').pop()}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[var(--muted-2)] text-[9px] italic pl-2">Ninguno</span>
            )}
          </div>
        </div>

        {/* Classes List */}
        {module.classes.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
              Clases ({module.classes.length})
            </span>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {module.classes.map((cls: ClassInfo) => (
                <div key={cls.id} className="bg-[var(--panel-2)] p-1.5 rounded text-[10px] border border-[var(--border-soft)]">
                  <div className="font-semibold text-[var(--cyan)]">{cls.name}</div>
                  <div className="text-[9px] text-[var(--muted-2)] font-mono">
                    {cls.methods.length} m / {cls.attributes.length} a | WMC: {cls.metrics.wmc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAntipatternDetails = (anti: Antipattern) => {
    return (
      <div className="space-y-2.5 bg-[var(--panel-2)] p-3 rounded-md border border-[var(--red)]/50 text-xs">
        <div className="flex items-center space-x-2 text-[var(--red)] font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{anti.name}</span>
        </div>
        <p className="text-[11px] text-[var(--text)]">{anti.description}</p>
        <div className="text-[10px] font-mono text-[var(--red)] bg-[var(--red)]/10 p-1.5 rounded border border-[var(--red)]/30 uppercase font-bold">
          Severidad: {anti.severity}
        </div>
        {anti.cyclePath && (
          <div className="space-y-1">
            <span className="text-[var(--muted)] text-[10px]">Ruta del Ciclo:</span>
            <div className="bg-[var(--bg)] p-2 rounded font-mono text-[10px] text-[var(--yellow)] space-y-0.5 border border-[var(--border-soft)]">
              {anti.cyclePath.map((pathItem: string, idx: number) => (
                <div key={idx}>➔ {pathItem}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-[275px] bg-[var(--panel)] border-l border-[var(--border)] flex flex-col h-full select-none shrink-0 font-sans transition-colors duration-200">
      {/* Header Pestañas Rightbar (Inspector vs Assistant IA) */}
      <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg)] h-[39px]">
        <button
          onClick={() => setRightTab('inspector')}
          className={`flex-1 h-full flex items-center justify-center space-x-1.5 text-[11px] font-semibold border-b-2 transition ${
            rightTab === 'inspector'
              ? 'border-[var(--purple)] text-[var(--text)] bg-[var(--panel)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>

        <button
          onClick={() => setRightTab('ai')}
          className={`flex-1 h-full flex items-center justify-center space-x-1.5 text-[11px] font-semibold border-b-2 transition ${
            rightTab === 'ai'
              ? 'border-[var(--cyan)] text-[var(--text)] bg-[var(--panel)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Asistente IA</span>
        </button>
      </div>

      {/* Body Rightbar */}
      <div className="flex-1 overflow-hidden">
        {rightTab === 'ai' ? (
          <AiChatPanel />
        ) : (
          <div className="h-full flex flex-col p-3 overflow-y-auto space-y-3 font-sans text-xs">
            {/* Si no hay nada seleccionado, mostrar Resumen Global / Fitness Score */}
            {!selectedId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="font-bold text-[var(--text)] text-xs uppercase tracking-wider">
                    Inspector Global
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {fitnessResult ? (
                  <div className="bg-[var(--panel-2)] p-3 rounded-lg border border-[var(--purple-border)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--purple)] uppercase">
                        Fitness Score Global
                      </span>
                      <ShieldCheck className="w-4 h-4 text-[var(--green)]" />
                    </div>
                    <div className="text-2xl font-black text-[var(--text)] font-mono">
                      {fitnessResult.fitnessScore}{' '}
                      <span className="text-xs text-[var(--muted)] font-normal">/ 100</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)]">
                      Evaluación multicriterio basada en 5 principios de arquitectura limpia.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-[var(--panel-2)] rounded-lg border border-[var(--border-soft)] text-center text-[var(--muted)] text-[11px] space-y-1">
                    <Info className="w-5 h-5 mx-auto text-[var(--purple)]" />
                    <p className="font-semibold text-[var(--text)]">Sin elemento seleccionado</p>
                    <p className="text-[10px]">
                      Haga clic en un nodo o elemento para inspecionar sus propiedades y métricas.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Si hay selección activa */
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="font-bold text-[var(--text)] text-xs uppercase tracking-wider">
                    Detalles ({selectedType})
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--text)] p-1 hover:bg-[var(--border-soft)] rounded"
                    title="Desmarcar selección"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {selectedType === 'module' && Boolean(selectedData) && renderModuleDetails(selectedData as Module)}
                {selectedType === 'antipattern' && Boolean(selectedData) && renderAntipatternDetails(selectedData as Antipattern)}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
