import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { Adr } from '../../../shared/types';

interface AdrCardProps {
  adr: Adr;
}

const statusConfig: Record<
  Adr['status'],
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  Accepted: {
    label: 'Aceptado',
    badgeClass: 'bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/30',
    icon: CheckCircle2,
  },
  Proposed: {
    label: 'Propuesto',
    badgeClass: 'bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]/30',
    icon: Clock,
  },
  Rejected: {
    label: 'Rechazado',
    badgeClass: 'bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30',
    icon: XCircle,
  },
  Deprecated: {
    label: 'Obsoleto',
    badgeClass: 'bg-[var(--yellow)]/10 text-[var(--yellow)] border-[var(--yellow)]/30',
    icon: AlertTriangle,
  },
  Superseded: {
    label: 'Reemplazado',
    badgeClass: 'bg-[var(--purple)]/10 text-[var(--purple)] border-[var(--purple)]/30',
    icon: RefreshCw,
  },
};

export const AdrCard: React.FC<AdrCardProps> = ({ adr }) => {
  const [expanded, setExpanded] = useState(false);

  const config = statusConfig[adr.status] || statusConfig.Proposed;
  const StatusIcon = config.icon;

  const exportMarkdown = () => {
    const formattedNum = String(adr.number).padStart(4, '0');
    let md = `# ${formattedNum}. ${adr.title}\n\n`;
    md += `* **Estado:** ${adr.status}\n`;
    md += `* **Fecha:** ${adr.date}\n`;
    md += `* **Autor:** ${adr.author}\n\n`;
    md += `## Contexto\n\n${adr.context}\n\n`;
    md += `## Decisión\n\n${adr.decision}\n\n`;
    md += `## Consecuencias\n\n${adr.consequences}\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADR-${formattedNum}-${adr.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
  };

  const numStr = String(adr.number).padStart(4, '0');

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--purple)]/40 rounded-xl p-5 shadow-lg space-y-3 transition font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-[var(--green)] font-bold">ADR-{numStr}</span>
              <h4 className="text-sm font-bold text-[var(--text)]">{adr.title}</h4>
            </div>
            <div className="flex items-center space-x-3 text-[10px] text-[var(--muted)] font-mono mt-1">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-[var(--muted-2)]" />
                <span>{adr.date}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <User className="w-3 h-3 text-[var(--muted-2)]" />
                <span>{adr.author}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded border font-semibold flex items-center space-x-1 ${config.badgeClass}`}>
            <StatusIcon className="w-3 h-3" />
            <span>{config.label}</span>
          </span>
          <button
            onClick={exportMarkdown}
            className="p-1.5 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border-soft)] transition"
            title="Exportar este ADR a Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sección Decisión (resumen siempre visible) */}
      <div className="bg-[var(--bg)] p-3 rounded-lg border border-[var(--border-soft)]">
        <strong className="text-[10px] uppercase font-bold text-[var(--green)] block mb-1">
          Decisión Tomada
        </strong>
        <p className="text-xs text-[var(--text)] leading-relaxed font-normal">{adr.decision}</p>
      </div>

      {/* Contexto y Consecuencias (expandibles) */}
      {expanded ? (
        <div className="space-y-3 pt-2 border-t border-[var(--border-soft)]">
          <div>
            <strong className="text-[10px] uppercase font-bold text-[var(--cyan)] block mb-1">
              Contexto &amp; Problema
            </strong>
            <p className="text-xs text-[var(--text)] leading-relaxed font-normal whitespace-pre-wrap">
              {adr.context}
            </p>
          </div>

          <div>
            <strong className="text-[10px] uppercase font-bold text-[var(--yellow)] block mb-1">
              Consecuencias &amp; Impacto
            </strong>
            <p className="text-xs text-[var(--text)] leading-relaxed font-normal whitespace-pre-wrap">
              {adr.consequences}
            </p>
          </div>
        </div>
      ) : null}

      {/* Botón para Expandir/Colapsar detalles */}
      <div className="pt-1 flex justify-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--cyan)] transition"
        >
          <span>{expanded ? 'Ver menos' : 'Ver contexto y consecuencias'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
