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
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--muted)]">
        <ShieldAlert className="w-12 h-12 text-[var(--yellow)]/40 mb-2" />
        <p className="font-semibold text-sm text-[var(--text)]">Sin datos de antipatrones.</p>
        <p className="text-xs text-[var(--muted)]">Analice un proyecto para detectar antipatrones de arquitectura.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200 overflow-hidden p-5 space-y-4 select-none font-sans">
      {/* Bar de resumen y filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)]">
        {/* Título & Contadores */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[var(--yellow)]/10 border border-[var(--yellow)]/20 text-[var(--yellow)]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text)]">Antipatrones Arquitectónicos</h2>
            <div className="flex items-center space-x-2 text-xs font-mono text-[var(--muted)] mt-0.5">
              <span>Total: <strong className="text-[var(--text)]">{counts.total}</strong></span>
              <span>•</span>
              <span className="text-[var(--red)]">Críticos: <strong>{counts.critical}</strong></span>
              <span>•</span>
              <span className="text-[var(--yellow)]">Altos: <strong>{counts.high}</strong></span>
              <span>•</span>
              <span className="text-[var(--cyan)]">Ciclos: <strong>{counts.cyclic}</strong></span>
            </div>
          </div>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
            <input
              type="text"
              placeholder="Filtrar antipatrones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--bg)] text-xs text-[var(--text)] pl-8 pr-2 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--cyan)] placeholder:text-[var(--muted-2)]"
            />
          </div>

          {/* Selector de Severidad */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as Severity | 'all')}
            className="bg-[var(--bg)] text-xs text-[var(--text)] px-3 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--cyan)]"
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
            className="bg-[var(--bg)] text-xs text-[var(--text)] px-3 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--cyan)]"
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
                ? 'bg-[var(--purple-soft)] text-[var(--purple)] border-[var(--purple-border)]'
                : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
            }`}
          >
            {showIgnored ? 'Ocultar Ignorados' : 'Ver Ignorados'}
          </button>
        </div>
      </div>

      {/* Lista de Tarjetas de Antipatrones */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredAntipatterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--muted)]">
            <CheckCircle2 className="w-10 h-10 text-[var(--green)]/40 mb-2" />
            <p className="font-semibold text-sm text-[var(--text)]">No se encontraron antipatrones.</p>
            <p className="text-xs text-[var(--muted)]">Pruebe ajustando los filtros de búsqueda.</p>
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
