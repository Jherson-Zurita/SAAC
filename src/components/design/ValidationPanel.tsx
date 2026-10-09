import React, { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useDesignStore } from '../../stores/useDesignStore';
import type { DesignIssue, DesignIssueSeverity } from './design-flow';

const SEVERITY_META: Record<
  DesignIssueSeverity,
  { label: string; icon: React.ElementType }
> = {
  error: { label: 'Errores', icon: AlertOctagon },
  warning: { label: 'Advertencias', icon: AlertTriangle },
  info: { label: 'Sugerencias', icon: Info },
};

export interface ValidationPanelProps {
  issues: DesignIssue[];
  onClose: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ issues, onClose }) => {
  const focusNodes = useDesignStore((state) => state.focusNodes);
  const [filter, setFilter] = useState<DesignIssueSeverity | 'all'>('all');

  const counts = useMemo(() => {
    const result: Record<DesignIssueSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) result[issue.severity] += 1;
    return result;
  }, [issues]);

  const visible = filter === 'all' ? issues : issues.filter((issue) => issue.severity === filter);

  return (
    <aside className="design-validation" aria-label="Validación arquitectónica">
      <header className="design-validation__header">
        <h2 className="design-validation__title">Validación arquitectónica</h2>
        <div className="design-validation__filters" role="group" aria-label="Filtrar por severidad">
          <button
            type="button"
            className={`design-validation__filter${filter === 'all' ? ' design-validation__filter--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas · {issues.length}
          </button>
          {(Object.keys(SEVERITY_META) as DesignIssueSeverity[]).map((severity) => (
            <button
              key={severity}
              type="button"
              className={`design-validation__filter design-validation__filter--${severity}${filter === severity ? ' design-validation__filter--active' : ''}`}
              onClick={() => setFilter(severity)}
              disabled={counts[severity] === 0}
            >
              {SEVERITY_META[severity].label} · {counts[severity]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="design-validation__close"
          onClick={onClose}
          aria-label="Cerrar validación"
        >
          <X aria-hidden="true" />
        </button>
      </header>

      {issues.length === 0 ? (
        <p className="design-validation__ok">
          <CheckCircle2 aria-hidden="true" />
          <span>Sin observaciones: el diseño cumple las reglas evaluadas.</span>
        </p>
      ) : (
        <ul className="design-validation__list">
          {visible.map((issue) => {
            const Icon = SEVERITY_META[issue.severity].icon;
            return (
              <li key={issue.id}>
                <button
                  type="button"
                  className={`design-validation__issue design-validation__issue--${issue.severity}`}
                  onClick={() => focusNodes(issue.nodeIds, issue.edgeIds)}
                  disabled={issue.nodeIds.length === 0 && issue.edgeIds.length === 0}
                  title="Mostrar en el lienzo"
                >
                  <Icon className="design-validation__icon" aria-hidden="true" />
                  <span className="design-validation__copy">
                    <strong>{issue.title}</strong>
                    <span>{issue.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};
