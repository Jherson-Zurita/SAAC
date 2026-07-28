import React, { useState, useMemo } from 'react';
import { AntipatternCard } from './AntipatternCard';
import { useProjectStore } from '../../stores/useProjectStore';
import { ShieldAlert, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Severity, AntipatternType } from '../../../shared/types';

export const AntipatternsPanel: React.FC = () => {
  const { amg } = useProjectStore();

  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedType, setSelectedType] = useState<AntipatternType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIgnored, setShowIgnored] = useState(false);

  const antipatterns = useMemo(() => amg?.antipatterns || [], [amg]);

  // Contadores
  const counts = useMemo(() => {
    let critical = 0;
    let high = 0;
    let cyclic = 0;
    antipatterns.forEach((a) => {
      if (a.severity === 'critical') critical++;
      if (a.severity === 'high') high++;
      if (a.antipatternType === 'circular-dependency') cyclic++;
    });
    return { total: antipatterns.length, critical, high, cyclic };
  }, [antipatterns]);

  // Filtrado
  const filteredAntipatterns = useMemo(() => {
    return antipatterns.filter((a) => {
      if (!showIgnored && a.ignored) return false;
      if (selectedSeverity !== 'all' && a.severity !== selectedSeverity) return false;
      if (selectedType !== 'all' && a.antipatternType !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesDesc = a.description.toLowerCase().includes(q);
        const matchesModule = a.affectedModuleIds.some((m) => m.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesModule) return false;
      }
      return true;
    });
  }, [antipatterns, selectedSeverity, selectedType, searchQuery, showIgnored]);

  if (!amg) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
        <ShieldAlert className="w-12 h-12 text-amber-500/40 mb-2" />
        <p className="font-semibold text-sm text-gray-300">Sin datos de antipatrones.</p>
        <p className="text-xs text-gray-500">Analice un proyecto para detectar antipatrones de arquitectura.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0d0f17] overflow-hidden p-5 space-y-4 select-none">
      {/* Bar de resumen y filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#121520] p-4 rounded-xl border border-[#1e2333]">
        {/* Título & Contadores */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Antipatrones Arquitectónicos</h2>
            <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 mt-0.5">
              <span>Total: <strong className="text-gray-200">{counts.total}</strong></span>
              <span>•</span>
              <span className="text-rose-400">Críticos: <strong>{counts.critical}</strong></span>
              <span>•</span>
              <span className="text-amber-400">Altos: <strong>{counts.high}</strong></span>
              <span>•</span>
              <span className="text-cyan-400">Ciclos: <strong>{counts.cyclic}</strong></span>
            </div>
          </div>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Filtrar antipatrones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#090b10] text-xs text-gray-200 pl-8 pr-2 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Selector de Severidad */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as Severity | 'all')}
            className="bg-[#090b10] text-xs text-gray-200 px-3 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todas las Severidades</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>

          {/* Selector de Tipo */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AntipatternType | 'all')}
            className="bg-[#090b10] text-xs text-gray-200 px-3 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Tipos</option>
            <option value="circular-dependency">Dependencia Circular</option>
            <option value="god-module">God Module</option>
            <option value="layer-violation">Violación de Capas</option>
            <option value="shotgun-surgery">Shotgun Surgery</option>
            <option value="feature-envy">Feature Envy</option>
            <option value="lollipop-problem">Lollipop Problem</option>
            <option value="concrete-class-dependency">Concrete Class Dep.</option>
          </select>

          {/* Toggle Ignorados */}
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              showIgnored
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                : 'bg-[#090b10] text-gray-400 border-[#1e2333] hover:text-gray-200'
            }`}
          >
            {showIgnored ? 'Ocultar Ignorados' : 'Ver Ignorados'}
          </button>
        </div>
      </div>

      {/* Lista de Tarjetas de Antipatrones */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredAntipatterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/40 mb-2" />
            <p className="font-semibold text-sm text-gray-300">No se encontraron antipatrones.</p>
            <p className="text-xs text-gray-500">Pruebe ajustando los filtros de búsqueda.</p>
          </div>
        ) : (
          filteredAntipatterns.map((a) => (
            <AntipatternCard key={a.id} antipattern={a} />
          ))
        )}
      </div>
    </div>
  );
};
