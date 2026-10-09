import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { NodeDiff } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import { EDGE_TYPE_META } from './design-flow';

const FIELD_LABELS: Record<string, string> = {
  label: 'Nombre',
  nodeType: 'Tipo',
};

function formatField(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field.startsWith('properties.') ? field.slice('properties.'.length) : field;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === 'string') return parsed;
      if (parsed === null) return '—';
    } catch {
      return value;
    }
    return value;
  }
  if (value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function shortId(id: string): string {
  const parts = id.split(/[/\\:]/).filter(Boolean);
  return parts[parts.length - 1] ?? id;
}

interface CategoryItem {
  id: string;
  label: string;
  hint?: string;
  focus?: () => void;
}

interface CategoryProps {
  title: string;
  items: CategoryItem[];
  variant: 'added' | 'removed';
}

const MAX_ITEMS = 30;

const Category: React.FC<CategoryProps> = ({ title, items, variant }) => (
  <section className={`design-comparison__category design-comparison__category--${variant}`}>
    <header className="design-comparison__category-header">
      <h3 className="design-comparison__category-title">{title}</h3>
      <span className="design-comparison__category-count">{items.length}</span>
    </header>
    {items.length === 0 ? (
      <p className="design-comparison__empty">Sin cambios.</p>
    ) : (
      <ul className="design-comparison__list">
        {items.slice(0, MAX_ITEMS).map((item) => (
          <li key={item.id} className="design-comparison__item">
            {item.focus ? (
              <button
                type="button"
                className="design-comparison__link"
                onClick={item.focus}
                title="Mostrar en el lienzo"
              >
                {item.label}
              </button>
            ) : (
              <span className="design-comparison__id" title={item.id}>{item.label}</span>
            )}
            {item.hint && <span className="design-comparison__hint">{item.hint}</span>}
          </li>
        ))}
        {items.length > MAX_ITEMS && (
          <li className="design-comparison__more">+{items.length - MAX_ITEMS} más</li>
        )}
      </ul>
    )}
  </section>
);

export const ComparisonPanel: React.FC = () => {
  const report = useDesignStore((state) => state.comparisonReport);
  const design = useDesignStore((state) => state.currentDesign);
  const focusNodes = useDesignStore((state) => state.focusNodes);
  const clearComparison = useDesignStore((state) => state.clearComparison);

  const nodeById = useMemo(
    () => new Map(design?.nodes.map((node) => [node.id, node]) ?? []),
    [design]
  );
  const edgeById = useMemo(
    () => new Map(design?.edges.map((edge) => [edge.id, edge]) ?? []),
    [design]
  );

  const modifiedByNode = useMemo(() => {
    const groups = new Map<string, NodeDiff[]>();
    for (const diff of report?.nodesModified ?? []) {
      const current = groups.get(diff.nodeId) ?? [];
      current.push(diff);
      groups.set(diff.nodeId, current);
    }
    return [...groups.entries()];
  }, [report]);

  if (!report) return null;

  const nodeItem = (id: string): CategoryItem => {
    const node = nodeById.get(id);
    return node
      ? { id, label: node.label, focus: () => focusNodes([id]) }
      : { id, label: shortId(id) };
  };

  const edgeItem = (id: string): CategoryItem => {
    const edge = edgeById.get(id);
    if (!edge) return { id, label: shortId(id) };
    const source = nodeById.get(edge.source)?.label ?? shortId(edge.source);
    const target = nodeById.get(edge.target)?.label ?? shortId(edge.target);
    return {
      id,
      label: `${source} → ${target}`,
      hint: EDGE_TYPE_META[edge.edgeType]?.label,
      focus: () => focusNodes([], [id]),
    };
  };

  return (
    <aside className="design-comparison" aria-label="Comparación arquitectónica">
      <header className="design-comparison__header">
        <div className="design-comparison__heading">
          <h2 className="design-comparison__title">Reporte de diferencias arquitectónicas</h2>
          <span className="design-comparison__run">Vs. AMG real (corrida {report.comparedAgainstRunId})</span>
          <button
            type="button"
            className="design-comparison__close"
            onClick={clearComparison}
            aria-label="Cerrar comparación"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <p className="design-comparison__summary">{report.structuralSummary}</p>
      </header>

      <div className="design-comparison__grid">
        <Category title="Nodos añadidos" items={report.nodesAdded.map(nodeItem)} variant="added" />
        <Category title="Nodos eliminados" items={report.nodesRemoved.map(nodeItem)} variant="removed" />
        <Category title="Aristas añadidas" items={report.edgesAdded.map(edgeItem)} variant="added" />
        <Category title="Aristas eliminadas" items={report.edgesRemoved.map(edgeItem)} variant="removed" />

        <section className="design-comparison__category design-comparison__category--modified">
          <header className="design-comparison__category-header">
            <h3 className="design-comparison__category-title">Nodos modificados</h3>
            <span className="design-comparison__category-count">{modifiedByNode.length}</span>
          </header>
          {modifiedByNode.length === 0 ? (
            <p className="design-comparison__empty">Sin cambios.</p>
          ) : (
            <div className="design-comparison__modified-list">
              {modifiedByNode.map(([nodeId, diffs]) => (
                <article key={nodeId} className="design-comparison__modified-node">
                  <button
                    type="button"
                    className="design-comparison__link"
                    onClick={() => focusNodes([nodeId])}
                  >
                    {nodeById.get(nodeId)?.label ?? shortId(nodeId)}
                  </button>
                  <dl className="design-comparison__diff-list">
                    {diffs.map((diff, index) => (
                      <div key={`${diff.field}-${index}`} className="design-comparison__diff">
                        <dt className="design-comparison__diff-field">{formatField(diff.field)}</dt>
                        <dd className="design-comparison__diff-values">
                          <span className="design-comparison__before">{formatValue(diff.before)}</span>
                          <span className="design-comparison__arrow" aria-hidden="true">→</span>
                          <span className="design-comparison__after">{formatValue(diff.after)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
