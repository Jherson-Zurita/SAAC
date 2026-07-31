import React, { useEffect, useState } from 'react';
import type { EdgeType } from '../../../shared/types';

const EDGE_TYPES: readonly { value: EdgeType; label: string }[] = [
  { value: 'dependency', label: 'Dependencia' },
  { value: 'containment', label: 'Contención' },
  { value: 'inheritance', label: 'Herencia' },
  { value: 'invocation', label: 'Invocación' },
  { value: 'external-call', label: 'Llamada externa' },
];

export interface EdgeEditorDialogProps {
  open: boolean;
  sourceLabel: string;
  targetLabel: string;
  onCancel: () => void;
  onSubmit: (edgeType: EdgeType, label?: string) => string | null | void;
}

export const EdgeEditorDialog: React.FC<EdgeEditorDialogProps> = ({
  open,
  sourceLabel,
  targetLabel,
  onCancel,
  onSubmit,
}) => {
  const [edgeType, setEdgeType] = useState<EdgeType>('dependency');
  const [label, setLabel] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEdgeType('dependency');
    setLabel('');
    setValidationError(null);
  }, [open, sourceLabel, targetLabel]);

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
          <label className="design-edge-dialog__field">
            <span className="design-edge-dialog__field-label">Tipo de arista</span>
            <select
              className="design-edge-dialog__select"
              value={edgeType}
              onChange={(event) => {
                setEdgeType(event.target.value as EdgeType);
                setValidationError(null);
              }}
              autoFocus
            >
              {EDGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="design-edge-dialog__field">
            <span className="design-edge-dialog__field-label">Etiqueta opcional</span>
            <input
              className="design-edge-dialog__input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Describe la relación"
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
