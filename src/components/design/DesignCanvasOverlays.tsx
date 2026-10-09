import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { EdgeType } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  EDGE_TYPE_META,
  NODE_TYPE_LABELS,
  normalizeSearchText,
} from './design-flow';

const MAX_RESULTS = 8;

export const DesignSearch: React.FC = () => {
  const nodes = useDesignStore((state) => state.currentDesign?.nodes);
  const focusNodes = useDesignStore((state) => state.focusNodes);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized || !nodes) return [];
    return nodes
      .filter((node) => normalizeSearchText(node.label).includes(normalized))
      .sort((a, b) => {
        const aStarts = normalizeSearchText(a.label).startsWith(normalized) ? 0 : 1;
        const bStarts = normalizeSearchText(b.label).startsWith(normalized) ? 0 : 1;
        return aStarts - bStarts || a.label.localeCompare(b.label);
      });
  }, [nodes, query]);

  const visibleResults = results.slice(0, MAX_RESULTS);

  const pick = (nodeId: string) => {
    focusNodes([nodeId]);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="design-search nodrag nopan" role="search">
      <div className="design-search__box">
        <Search className="design-search__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="design-search__input"
          value={query}
          placeholder="Buscar componente (Ctrl+F)"
          aria-label="Buscar componente en el lienzo"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, visibleResults.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              if (event.shiftKey && results.length > 0) {
                focusNodes(results.map((node) => node.id));
                setOpen(false);
              } else if (visibleResults[activeIndex]) {
                pick(visibleResults[activeIndex].id);
              }
            } else if (event.key === 'Escape') {
              setQuery('');
              event.currentTarget.blur();
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="design-search__clear"
            aria-label="Limpiar búsqueda"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuery('')}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <ul className="design-search__results" role="listbox">
          {visibleResults.length === 0 && (
            <li className="design-search__empty">Sin coincidencias.</li>
          )}
          {visibleResults.map((node, index) => (
            <li key={node.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`design-search__result${index === activeIndex ? ' design-search__result--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(node.id)}
              >
                <span className="design-search__result-label">{node.label}</span>
                <span className="design-search__result-type">{NODE_TYPE_LABELS[node.nodeType]}</span>
              </button>
            </li>
          ))}
          {results.length > 1 && (
            <li className="design-search__footer">
              {results.length} coincidencias · Shift+Enter selecciona todas
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export const DesignLegend: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="design-legend nodrag nopan">
      <button
        type="button"
        className="design-legend__toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>Leyenda</span>
        {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
      </button>
      {expanded && (
        <div className="design-legend__body">
          <ul className="design-legend__list">
            {(Object.keys(EDGE_TYPE_META) as EdgeType[]).map((type) => {
              const meta = EDGE_TYPE_META[type];
              return (
                <li key={type} className="design-legend__item" title={meta.description}>
                  <svg className="design-legend__line" viewBox="0 0 32 8" aria-hidden="true">
                    <line
                      x1="0"
                      y1="4"
                      x2="32"
                      y2="4"
                      stroke={meta.color}
                      strokeWidth="2"
                      strokeDasharray={meta.dash}
                    />
                  </svg>
                  <span>{meta.label}</span>
                </li>
              );
            })}
          </ul>
          <ul className="design-legend__list">
            <li className="design-legend__item">
              <span className="design-legend__swatch design-legend__swatch--imported" />
              <span>Importado del AMG</span>
            </li>
            <li className="design-legend__item">
              <span className="design-legend__swatch design-legend__swatch--proposed" />
              <span>Propuesto</span>
            </li>
          </ul>
          <p className="design-legend__hint">
            Doble clic: renombrar · Ctrl+D: duplicar · Ctrl+C/V: copiar/pegar · Arrastra el extremo de una arista para reconectarla
          </p>
        </div>
      )}
    </div>
  );
};
