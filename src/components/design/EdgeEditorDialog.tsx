import React, { useEffect, useState } from 'react';
import type { EdgeType } from '../../../shared/types';
import { EDGE_TYPE_META, EDGE_TYPE_OPTIONS } from './design-flow';

export interface EdgeEditorDialogProps {
  open: boolean;
  sourceLabel: string;
  targetLabel: string;
  suggestedType?: EdgeType;
  onCancel: () => void;
  onSubmit: (edgeType: EdgeType, label?: string) => string | null | void;
}

export const EdgeEditorDialog: React.FC<EdgeEditorDialogProps> = ({
  open,
  sourceLabel,
  targetLabel,
  suggestedType = 'dependency',
  onCancel,
  onSubmit,
}) => {
  const [edgeType, setEdgeType] = useState<EdgeType>(suggestedType);
  const [label, setLabel] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEdgeType(suggestedType);
    setLabel('');
    setValidationError(null);
  }, [open, sourceLabel, targetLabel, suggestedType]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = onSubmit(edgeType, label.trim() || undefined);
    setValidationError(error || null);
  };

  return (
    <div className="design-edge-dialog__backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="design-edge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-edge-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="design-edge-dialog__header">
          <h2 id="design-edge-dialog-title" className="design-edge-dialog__title">
            Nueva conexión
          </h2>
          <p className="design-edge-dialog__route">
            {sourceLabel} → {targetLabel}
          </p>
        </header>

        <form className="design-edge-dialog__form" onSubmit={handleSubmit}>
          <fieldset className="design-edge-dialog__types">
            <legend className="design-edge-dialog__field-label">Tipo de arista</legend>
            {EDGE_TYPE_OPTIONS.map((option) => {
              const meta = EDGE_TYPE_META[option.value];
              return (
                <label
                  key={option.value}
                  className={`design-edge-dialog__type${edgeType === option.value ? ' design-edge-dialog__type--active' : ''}`}
                  style={{ '--edge-accent': meta.color } as React.CSSProperties}
                >
                  <input
                    type="radio"
                    name="edge-type"
                    value={option.value}
                    checked={edgeType === option.value}
                    autoFocus={option.value === suggestedType}
                    onChange={() => {
                      setEdgeType(option.value);
                      setValidationError(null);
                    }}
                  />
                  <span className="design-edge-dialog__type-copy">
                    <strong>
                      {option.label}
                      {option.value === suggestedType && (
                        <span className="design-edge-dialog__suggested">sugerido</span>
                      )}
                    </strong>
                    <span>{meta.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <label className="design-edge-dialog__field">
            <span className="design-edge-dialog__field-label">Etiqueta opcional</span>
            <input
              className="design-edge-dialog__input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. REST/JSON, publica eventos, lee usuarios"
            />
          </label>

          {validationError && (
            <p className="design-edge-dialog__error" role="alert">
              {validationError}
            </p>
          )}

          <footer className="design-edge-dialog__actions">
            <button
              type="button"
              className="design-edge-dialog__button design-edge-dialog__button--secondary"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="design-edge-dialog__button design-edge-dialog__button--primary"
            >
              Crear conexión
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
