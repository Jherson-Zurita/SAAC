import React, { useState } from 'react';
import {
  X,
  FileCode,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
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
        ? '#4FD49A'
        : m.maintainabilityIndex >= 60
          ? '#E7B85B'
          : '#EF6B73';

    // Find inbound & outbound dependencies for this module
    const inboundDeps = (amg?.dependencies || []).filter((d) => d.target === module.id);
    const outboundDeps = (amg?.dependencies || []).filter((d) => d.source === module.id);

    return (
      <div className="space-y-3 font-sans text-xs">
        {/* Module Header Card (GraphForge Spec Section 26) */}
        <div className="bg-[#13171D] p-2.5 rounded-md border border-[#1D222A] space-y-1">
          <div className="flex items-center space-x-2 text-[#8B7CFF] font-semibold text-xs">
            <FileCode className="w-4 h-4 shrink-0" />
            <span className="truncate">{module.name}</span>
          </div>
          <p className="text-[10px] text-[#5F6671] font-mono truncate" title={module.id}>
            {module.id}
          </p>
        </div>

        {/* Section: Properties (GraphForge Spec Section 27 — Two Column Layout) */}
        <div className="space-y-1 bg-[#13171D] p-2.5 rounded-md border border-[#1D222A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6671] mb-1 block">
            Propiedades
          </span>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-[#5F6671]">Lenguaje</span>
              <span className="text-[#45C8DF] font-semibold uppercase">{module.language}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5F6671]">Tipo</span>
              <span className="text-[#8B7CFF] font-semibold">{module.moduleType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5F6671]">Líneas (LOC)</span>
              <span className="text-[#E6E9ED] font-mono">{module.loc}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5F6671]">Clases / Func</span>
              <span className="text-[#858C98] font-mono">
                {module.classes.length} c / {module.functions.length} f
              </span>
            </div>
          </div>
        </div>

        {/* Section: Metrics (GraphForge Spec Section 28 — Compact 2x2 Grid) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6671] flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-[#8B7CFF]" /> Métricas de Calidad
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-[#13171D] p-2 rounded-md border border-[#1D222A] flex flex-col gap-0.5">
              <span className="text-[#5F6671]">Mantenibilidad</span>
              <span className="font-bold font-mono text-xs" style={{ color: miColor }}>
                {Math.round(m.maintainabilityIndex)} / 100
              </span>
            </div>

            <div className="bg-[#13171D] p-2 rounded-md border border-[#1D222A] flex flex-col gap-0.5">
              <span className="text-[#5F6671]">CC Máx</span>
              <span
                className={`font-bold font-mono text-xs ${
                  m.cyclomaticComplexityMax > 15 ? 'text-[#EF6B73]' : 'text-[#4FD49A]'
                }`}
              >
                {m.cyclomaticComplexityMax}
              </span>
            </div>

            <div className="bg-[#13171D] p-2 rounded-md border border-[#1D222A] flex flex-col gap-0.5">
              <span className="text-[#5F6671]">Aferente (Ca)</span>
              <span className="font-bold font-mono text-xs text-[#45C8DF]">{m.ca}</span>
            </div>

            <div className="bg-[#13171D] p-2 rounded-md border border-[#1D222A] flex flex-col gap-0.5">
              <span className="text-[#5F6671]">Eferente (Ce)</span>
              <span className="font-bold font-mono text-xs text-[#8B7CFF]">{m.ce}</span>
            </div>
          </div>
        </div>

        {/* Section: Connections (GraphForge Spec Section 29 — Compact List) */}
        <div className="space-y-1.5 pt-1 border-t border-[#252B34]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6671]">
            Conexiones ({inboundDeps.length + outboundDeps.length})
          </span>

          <div className="space-y-1 text-[10px]">
            <div className="flex items-center text-[#858C98] gap-1">
              <ArrowDownLeft className="w-3 h-3 text-[#4FD49A]" />
              <span>Importado por ({inboundDeps.length}):</span>
            </div>
            {inboundDeps.length > 0 ? (
              <div className="space-y-0.5 max-h-24 overflow-y-auto pl-2">
                {inboundDeps.map((d, i) => (
                  <div
                    key={i}
                    className="p-1 rounded bg-[#13171D] hover:bg-[#171C23] text-[#E6E9ED] font-mono truncate border border-[#1D222A]"
                  >
                    ● {d.source.split('/').pop()}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[#5F6671] text-[9px] italic pl-2">Ninguno</span>
            )}

            <div className="flex items-center text-[#858C98] gap-1 pt-1">
              <ArrowUpRight className="w-3 h-3 text-[#45C8DF]" />
              <span>Importa a ({outboundDeps.length}):</span>
            </div>
            {outboundDeps.length > 0 ? (
              <div className="space-y-0.5 max-h-24 overflow-y-auto pl-2">
                {outboundDeps.map((d, i) => (
                  <div
                    key={i}
                    className="p-1 rounded bg-[#13171D] hover:bg-[#171C23] text-[#E6E9ED] font-mono truncate border border-[#1D222A]"
                  >
                    ● {d.target.split('/').pop()}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[#5F6671] text-[9px] italic pl-2">Ninguno</span>
            )}
          </div>
        </div>

        {/* Classes List */}
        {module.classes.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-[#252B34]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6671]">
              Clases ({module.classes.length})
            </span>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {module.classes.map((cls: ClassInfo) => (
                <div key={cls.id} className="bg-[#13171D] p-1.5 rounded text-[10px] border border-[#1D222A]">
                  <div className="font-semibold text-[#45C8DF]">{cls.name}</div>
                  <div className="text-[9px] text-[#5F6671] font-mono">
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
      <div className="space-y-2.5 bg-[#171C23] p-3 rounded-md border border-[#EF6B73]/50 text-xs">
        <div className="flex items-center space-x-2 text-[#EF6B73] font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{anti.name}</span>
        </div>
        <p className="text-[11px] text-[#E6E9ED]">{anti.description}</p>
        <div className="text-[10px] font-mono text-[#EF6B73] bg-[#EF6B73]/10 p-1.5 rounded border border-[#EF6B73]/30 uppercase font-bold">
          Severidad: {anti.severity}
        </div>
        {anti.cyclePath && (
          <div className="space-y-1">
            <span className="text-[#858C98] text-[10px]">Ruta del Ciclo:</span>
            <div className="bg-[#0B0D10] p-2 rounded font-mono text-[10px] text-[#E7B85B] space-y-0.5 border border-[#252B34]">
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
    <aside className="w-[275px] bg-[#101318] border-l border-[#252B34] flex flex-col h-full select-none shrink-0 font-sans">
      {/* Header Pestañas Rightbar (Inspector vs Assistant IA) */}
      <div className="flex items-center border-b border-[#252B34] bg-[#0B0D10] h-[39px]">
        <button
          onClick={() => setRightTab('inspector')}
          className={`flex-1 h-full flex items-center justify-center space-x-1.5 text-[11px] font-semibold border-b-2 transition ${
            rightTab === 'inspector'
              ? 'border-[#8B7CFF] text-[#E6E9ED] bg-[#101318]'
              : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>

        <button
          onClick={() => setRightTab('ai')}
          className={`flex-1 h-full flex items-center justify-center space-x-1.5 text-[11px] font-semibold border-b-2 transition ${
            rightTab === 'ai'
              ? 'border-[#45C8DF] text-[#E6E9ED] bg-[#101318]'
              : 'border-transparent text-[#858C98] hover:text-[#E6E9ED]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Asistente IA</span>
        </button>

        {selectedId && rightTab === 'inspector' && (
          <button
            onClick={clearSelection}
            className="px-2 text-[#858C98] hover:text-[#E6E9ED]"
            title="Limpiar selección"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body Section */}
      {rightTab === 'ai' ? (
        <AiChatPanel />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 text-xs">
          {selectedId && selectedData ? (
            <div>
              {selectedType === 'module' && renderModuleDetails(selectedData as Module)}
              {selectedType === 'antipattern' && renderAntipatternDetails(selectedData as Antipattern)}
              {selectedType !== 'module' && selectedType !== 'antipattern' && (
                <div className="bg-[#13171D] p-3 rounded-md border border-[#1D222A] space-y-2">
                  <div className="font-bold text-[#8B7CFF] uppercase text-xs">{selectedType}</div>
                  <div className="font-mono text-[#E6E9ED] text-[10px] break-all">{selectedId}</div>
                  <pre className="text-[9px] text-[#858C98] bg-[#0B0D10] p-2 rounded overflow-x-auto border border-[#252B34]">
                    {JSON.stringify(selectedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {amg ? (
                <div className="space-y-3">
                  {/* Project Overview Card */}
                  <div className="bg-[#13171D] p-3 rounded-md border border-[#1D222A] space-y-2">
                    <h3 className="font-bold text-xs text-[#E6E9ED]">{amg.projectName}</h3>
                    <div className="flex items-center space-x-1.5 text-[10px] text-[#45C8DF]">
                      <Zap className="w-3 h-3" />
                      <span>Estilo: {amg.detectedStyle} ({Math.round(amg.styleConfidence * 100)}%)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                      <div className="bg-[#0B0D10] p-1.5 rounded border border-[#252B34]">
                        <span className="text-[#5F6671] text-[9px]">Módulos</span>
                        <p className="font-bold text-[#8B7CFF] font-mono">{amg.modules.length}</p>
                      </div>
                      <div className="bg-[#0B0D10] p-1.5 rounded border border-[#252B34]">
                        <span className="text-[#5F6671] text-[9px]">Dependencias</span>
                        <p className="font-bold text-[#45C8DF] font-mono">{amg.dependencies.length}</p>
                      </div>
                      <div className="bg-[#0B0D10] p-1.5 rounded border border-[#252B34]">
                        <span className="text-[#5F6671] text-[9px]">Antipatrones</span>
                        <p className="font-bold text-[#E7B85B] font-mono">{amg.antipatterns.length}</p>
                      </div>
                      <div className="bg-[#0B0D10] p-1.5 rounded border border-[#252B34]">
                        <span className="text-[#5F6671] text-[9px]">Líneas LOC</span>
                        <p className="font-bold text-[#4FD49A] font-mono">{amg.metrics.totalLoc}</p>
                      </div>
                    </div>
                  </div>

                  {fitnessResult && (
                    <div className="bg-[#13171D] p-3 rounded-md border border-[#8B7CFF]/40 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#858C98]">Fitness Score Global</span>
                        <div className="text-base font-extrabold text-[#8B7CFF] font-mono">
                          {fitnessResult.fitnessScore} / 100
                        </div>
                      </div>
                      <ShieldCheck className="w-7 h-7 text-[#8B7CFF]/60" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center text-[#5F6671] space-y-2">
                  <Info className="w-7 h-7 opacity-30 text-[#8B7CFF]" />
                  <p className="font-medium text-[#858C98]">Sin selección</p>
                  <p className="text-[10px] text-[#5F6671]">
                    Haga clic en un nodo o módulo para inspeccionar sus propiedades.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
