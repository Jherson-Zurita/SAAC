import React, { useMemo } from 'react';
import type { NodeDiff } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface IdCategoryProps {
  title: string;
  items: string[];
  variant: 'added' | 'removed';
}

const IdCategory: React.FC<IdCategoryProps> = ({ title, items, variant }) => (
  <section className={`design-comparison__category design-comparison__category--${variant}`}>
    <header className="design-comparison__category-header">
      <h3 className="design-comparison__category-title">{title}</h3>
      <span className="design-comparison__category-count">{items.length}</span>
    </header>
    {items.length === 0 ? (
      <p className="design-comparison__empty">Sin cambios.</p>
    ) : (
      <ul className="design-comparison__list">
        {items.map((item) => (
          <li key={item} className="design-comparison__item">
            <code className="design-comparison__id">{item}</code>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const ComparisonPanel: React.FC = () => {
  const report = useDesignStore((state) => state.comparisonReport);

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

  return (
    <aside className="design-comparison" aria-label="Comparación arquitectónica">
      <header className="design-comparison__header">
        <div className="design-comparison__heading">
          <h2 className="design-comparison__title">Comparación</h2>
          <span className="design-comparison__run">Corrida {report.comparedAgainstRunId}</span>
        </div>
        <p className="design-comparison__summary">{report.structuralSummary}</p>
      </header>

      <div className="design-comparison__grid">
        <IdCategory title="Nodos añadidos" items={report.nodesAdded} variant="added" />
        <IdCategory title="Nodos eliminados" items={report.nodesRemoved} variant="removed" />
        <IdCategory title="Aristas añadidas" items={report.edgesAdded} variant="added" />
        <IdCategory title="Aristas eliminadas" items={report.edgesRemoved} variant="removed" />

        <section className="design-comparison__category design-comparison__category--modified">
          <header className="design-comparison__category-header">
            <h3 className="design-comparison__category-title">Nodos modificados</h3>
            <span className="design-comparison__category-count">
              {report.nodesModified.length}
            </span>
          </header>
          {modifiedByNode.length === 0 ? (
            <p className="design-comparison__empty">Sin cambios.</p>
          ) : (
            <div className="design-comparison__modified-list">
              {modifiedByNode.map(([nodeId, diffs]) => (
                <article key={nodeId} className="design-comparison__modified-node">
                  <code className="design-comparison__id">{nodeId}</code>
                  <dl className="design-comparison__diff-list">
                    {diffs.map((diff, index) => (
                      <div
                        key={`${diff.field}-${index}`}
                        className="design-comparison__diff"
                      >
                        <dt className="design-comparison__diff-field">{diff.field}</dt>
                        <dd className="design-comparison__diff-values">
                          <span className="design-comparison__before">
                            {formatValue(diff.before)}
                          </span>
                          <span className="design-comparison__arrow" aria-hidden="true">
                            →
                          </span>
                          <span className="design-comparison__after">
                            {formatValue(diff.after)}
                          </span>
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
