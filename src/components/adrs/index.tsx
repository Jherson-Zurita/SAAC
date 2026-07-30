import React, { useState, useMemo } from 'react';
import { AdrCard } from './AdrCard';
import { AdrFormModal } from './AdrFormModal';
import { RiskCard } from './RiskCard';
import { RiskFormModal } from './RiskFormModal';
import { AnnotationCard } from './AnnotationCard';
import { useProjectStore } from '../../stores/useProjectStore';
import {
  FileText,
  AlertTriangle,
  MessageSquare,
  Plus,
  Search,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import type { Adr, Risk } from '../../../shared/types';

export const AdrsPanel: React.FC = () => {
  const { annotations } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'adrs' | 'risks' | 'annotations'>('adrs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Adr['status'] | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<Risk['severity'] | 'all'>('all');

  const [isAdrModalOpen, setIsAdrModalOpen] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);

  const adrs = useMemo(() => annotations?.adrs || [], [annotations]);
  const risks = useMemo(() => annotations?.risks || [], [annotations]);
  const techAnnotations = useMemo(() => annotations?.annotations || [], [annotations]);

  // Contadores
  const adrCounts = useMemo(() => {
    let accepted = 0;
    let proposed = 0;
    adrs.forEach((a) => {
      if (a.status === 'Accepted') accepted++;
      if (a.status === 'Proposed') proposed++;
    });
    return { total: adrs.length, accepted, proposed };
  }, [adrs]);

  const riskCounts = useMemo(() => {
    let critical = 0;
    let high = 0;
    risks.forEach((r) => {
      if (r.severity === 'Critical') critical++;
      if (r.severity === 'High') high++;
    });
    return { total: risks.length, critical, high };
  }, [risks]);

  // Filtrado de ADRs
  const filteredAdrs = useMemo(() => {
    return adrs.filter((a) => {
      if (selectedStatus !== 'all' && a.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesDecision = a.decision.toLowerCase().includes(q);
        const matchesContext = a.context.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDecision && !matchesContext) return false;
      }
      return true;
    });
  }, [adrs, selectedStatus, searchQuery]);

  // Filtrado de Riesgos
  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (selectedSeverity !== 'all' && r.severity !== selectedSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [risks, selectedSeverity, searchQuery]);

  // Filtrado de Anotaciones
  const filteredAnnotations = useMemo(() => {
    return techAnnotations.filter((ann) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ann.title.toLowerCase().includes(q);
        const matchesContent = ann.content.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent) return false;
      }
      return true;
    });
  }, [techAnnotations, searchQuery]);

  const nextAdrNumber = useMemo(() => {
    if (adrs.length === 0) return 1;
    const maxNum = Math.max(...adrs.map((a) => a.number));
    return maxNum + 1;
  }, [adrs]);

  return (
    <div className="flex-1 flex flex-col bg-[#0d0f17] overflow-hidden p-5 space-y-4 select-none">
      {/* Top Header & Contadores */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#121520] p-4 rounded-xl border border-[#1e2333]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">
              Gestor de Decisiones Arquitectónicas (ADRs) &amp; Riesgos
            </h2>
            <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 mt-0.5">
              <span>ADRs: <strong className="text-gray-200">{adrCounts.total}</strong></span>
              <span>•</span>
              <span className="text-emerald-400">Aceptados: <strong>{adrCounts.accepted}</strong></span>
              <span>•</span>
              <span className="text-amber-400">Riesgos Críticos: <strong>{riskCounts.critical}</strong></span>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center space-x-2">
          {activeTab === 'adrs' && (
            <button
              onClick={() => setIsAdrModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo ADR</span>
            </button>
          )}

          {activeTab === 'risks' && (
            <button
              onClick={() => setIsRiskModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Riesgo</span>
            </button>
          )}
        </div>
      </div>

      {/* Navegación por Sub-pestañas y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-1 bg-[#121520] p-1 rounded-xl border border-[#1e2333]">
          <button
            onClick={() => setActiveTab('adrs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'adrs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ADRs ({adrs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('risks')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'risks'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Riesgos ({risks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('annotations')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
              activeTab === 'annotations'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Anotaciones ({techAnnotations.length})</span>
          </button>
        </div>

        {/* Búsqueda y Filtros de Estado */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#090b10] text-xs text-gray-200 pl-8 pr-2 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500"
            />
          </div>

          {activeTab === 'adrs' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as Adr['status'] | 'all')}
              className="bg-[#090b10] text-xs text-gray-200 px-3 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="all">Todos los Estados</option>
              <option value="Accepted">Aceptados</option>
              <option value="Proposed">Propuestos</option>
              <option value="Rejected">Rechazados</option>
              <option value="Deprecated">Obsoletos</option>
              <option value="Superseded">Reemplazados</option>
            </select>
          )}

          {activeTab === 'risks' && (
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as Risk['severity'] | 'all')}
              className="bg-[#090b10] text-xs text-gray-200 px-3 py-1.5 rounded-lg border border-[#1e2333] focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="all">Todas las Severidades</option>
              <option value="Critical">Crítico</option>
              <option value="High">Alto</option>
              <option value="Medium">Medio</option>
              <option value="Low">Bajo</option>
            </select>
          )}
        </div>
      </div>

      {/* Lista Principal según Pestaña Activa */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activeTab === 'adrs' && (
          filteredAdrs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-400/40 mb-2" />
              <p className="font-semibold text-sm text-gray-300">No hay decisiones registadas.</p>
              <p className="text-xs text-gray-500">Haga clic en "+ Nuevo ADR" para registrar una decisión arquitectónica.</p>
            </div>
          ) : (
            filteredAdrs.map((adr) => <AdrCard key={adr.id} adr={adr} />)
          )
        )}

        {activeTab === 'risks' && (
          filteredRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
              <ShieldCheck className="w-10 h-10 text-amber-400/40 mb-2" />
              <p className="font-semibold text-sm text-gray-300">No hay riesgos registrados.</p>
              <p className="text-xs text-gray-500">Haga clic en "+ Nuevo Riesgo" para auditar posibles riesgos técnicos.</p>
            </div>
          ) : (
            filteredRisks.map((risk) => <RiskCard key={risk.id} risk={risk} />)
          )
        )}

        {activeTab === 'annotations' && (
          filteredAnnotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
              <MessageSquare className="w-10 h-10 text-cyan-400/40 mb-2" />
              <p className="font-semibold text-sm text-gray-300">No hay anotaciones técnicas.</p>
              <p className="text-xs text-gray-500">Las notas técnicas guardadas aparecerán aquí.</p>
            </div>
          ) : (
            filteredAnnotations.map((ann) => <AnnotationCard key={ann.id} annotation={ann} />)
          )
        )}
      </div>

      {/* Modales Formulario */}
      <AdrFormModal
        isOpen={isAdrModalOpen}
        onClose={() => setIsAdrModalOpen(false)}
        nextNumber={nextAdrNumber}
      />
      <RiskFormModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
      />
    </div>
  );
};
