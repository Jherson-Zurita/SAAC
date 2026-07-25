import React from 'react';
import {
  X,
  FileCode,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Module, Antipattern, ClassInfo } from '../../../shared/types';

export const Rightbar: React.FC = () => {
  const { rightbarOpen } = useUiStore();
  const { selectedId, selectedType, selectedData, clearSelection } = useSelectionStore();
  const { amg, fitnessResult } = useProjectStore();

  if (!rightbarOpen) return null;

  const renderModuleDetails = (module: Module) => {
    const m = module.metrics;
    return (
      <div className="space-y-4">
        <div className="bg-[#181c2a] p-3 rounded-lg border border-[#232a3e]">
          <div className="flex items-center space-x-2 text-blue-400 font-semibold text-sm mb-1">
            <FileCode className="w-4 h-4" />
            <span className="truncate">{module.name}</span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono break-all">{module.id}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#10131d] p-2 rounded">
              <span className="text-gray-500 text-[10px]">Lenguaje</span>
              <p className="font-semibold text-cyan-300 uppercase">{module.language}</p>
            </div>
            <div className="bg-[#10131d] p-2 rounded">
              <span className="text-gray-500 text-[10px]">Rol</span>
              <p className="font-semibold text-purple-300">{module.moduleType}</p>
            </div>
            <div className="bg-[#10131d] p-2 rounded">
              <span className="text-gray-500 text-[10px]">Líneas LOC</span>
              <p className="font-semibold text-gray-200">{module.loc}</p>
            </div>
            <div className="bg-[#10131d] p-2 rounded">
              <span className="text-gray-500 text-[10px]">Clases / Func</span>
              <p className="font-semibold text-gray-200">
                {module.classes.length} c / {module.functions.length} f
              </p>
            </div>
          </div>
        </div>

        {/* Métricas del Módulo */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Métricas de Acoplamiento
          </h4>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Mantenibilidad (MI)</span>
              <span
                className={`font-bold font-mono ${
                  m.maintainabilityIndex >= 80
                    ? 'text-emerald-400'
                    : m.maintainabilityIndex >= 60
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {Math.round(m.maintainabilityIndex)} / 100
              </span>
            </div>

            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Aferente (Ca)</span>
              <span className="font-mono text-cyan-300">{m.ca}</span>
            </div>

            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Eferente (Ce)</span>
              <span className="font-mono text-purple-300">{m.ce}</span>
            </div>

            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Instabilidad (I)</span>
              <span className="font-mono text-amber-300">{m.instability.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Abstractness (A)</span>
              <span className="font-mono text-blue-300">{m.abstractness.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center bg-[#141724] p-2 rounded">
              <span className="text-gray-400">Distancia (D)</span>
              <span className="font-mono text-rose-300">{m.distance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Lista de Clases */}
        {module.classes.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Clases ({module.classes.length})
            </h4>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {module.classes.map((cls: ClassInfo) => (
                <div key={cls.id} className="bg-[#141724] p-2 rounded text-xs">
                  <div className="font-semibold text-cyan-300">{cls.name}</div>
                  <div className="text-[10px] text-gray-500">
                    {cls.methods.length} métodos | {cls.attributes.length} attrs | WMC: {cls.metrics.wmc}
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
      <div className="space-y-3 bg-[#1c1822] p-3 rounded-lg border border-amber-500/30">
        <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{anti.name}</span>
        </div>
        <p className="text-xs text-gray-300">{anti.description}</p>
        <div className="text-xs font-mono text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
          Severidad: {anti.severity.toUpperCase()}
        </div>
        {anti.cyclePath && (
          <div className="space-y-1 text-xs">
            <span className="text-gray-400 font-medium">Ciclo detectado:</span>
            <div className="bg-[#120f18] p-2 rounded font-mono text-[11px] text-amber-300 space-y-0.5">
              {anti.cyclePath.map((pathItem: string, idx: number) => (
                <div key={idx}>→ {pathItem}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-72 bg-[#12151e] border-l border-[#232838] flex flex-col h-full select-none">
      {/* Header del Rightbar */}
      <div className="h-10 px-3 border-b border-[#232838] flex items-center justify-between bg-[#0d0f16]">
        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>Inspector de Detalles</span>
        </div>

        <div className="flex items-center space-x-1">
          {selectedId && (
            <button
              onClick={clearSelection}
              className="p-1 text-gray-400 hover:text-white hover:bg-[#1f2433] rounded"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo del Rightbar */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {selectedId && selectedData ? (
          <div>
            {selectedType === 'module' && renderModuleDetails(selectedData as Module)}
            {selectedType === 'antipattern' && renderAntipatternDetails(selectedData as Antipattern)}
            {selectedType !== 'module' && selectedType !== 'antipattern' && (
              <div className="bg-[#181c2a] p-3 rounded-lg border border-[#232a3e] space-y-2">
                <div className="font-semibold text-blue-400 uppercase">{selectedType}</div>
                <div className="font-mono text-gray-300 break-all">{selectedId}</div>
                <pre className="text-[10px] text-gray-400 bg-[#0c0e15] p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen del Proyecto si no hay nada seleccionado */}
            {amg ? (
              <div className="space-y-3">
                <div className="bg-[#181c2a] p-3 rounded-lg border border-[#232a3e]">
                  <h3 className="font-bold text-sm text-gray-100 mb-1">{amg.projectName}</h3>
                  <div className="flex items-center space-x-2 text-xs text-cyan-400 mb-3">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Estilo: {amg.detectedStyle} ({Math.round(amg.styleConfidence * 100)}%)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#10131d] p-2 rounded">
                      <span className="text-gray-500 text-[10px]">Módulos</span>
                      <p className="font-bold text-blue-400">{amg.modules.length}</p>
                    </div>
                    <div className="bg-[#10131d] p-2 rounded">
                      <span className="text-gray-500 text-[10px]">Dependencias</span>
                      <p className="font-bold text-purple-400">{amg.dependencies.length}</p>
                    </div>
                    <div className="bg-[#10131d] p-2 rounded">
                      <span className="text-gray-500 text-[10px]">Antipatrones</span>
                      <p className="font-bold text-amber-400">{amg.antipatterns.length}</p>
                    </div>
                    <div className="bg-[#10131d] p-2 rounded">
                      <span className="text-gray-500 text-[10px]">Líneas LOC</span>
                      <p className="font-bold text-emerald-400">{amg.metrics.totalLoc}</p>
                    </div>
                  </div>
                </div>

                {/* Fitness Score Badge */}
                {fitnessResult && (
                  <div className="bg-[#141b2b] p-3 rounded-lg border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium">Fitness Score Global</span>
                      <div className="text-lg font-extrabold text-blue-400">
                        {fitnessResult.fitnessScore} / 100
                      </div>
                    </div>
                    <ShieldCheck className="w-8 h-8 text-blue-400/60" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500 space-y-2">
                <Info className="w-8 h-8 opacity-40 text-blue-400" />
                <p>Ningún elemento seleccionado.</p>
                <p className="text-[11px] text-gray-600">
                  Haga clic en un nodo o módulo del canvas para inspeccionar sus métricas.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
