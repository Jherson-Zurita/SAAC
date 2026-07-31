import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type {
  EdgeType,
  ProposedNode,
  ProposedNodeType,
} from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';

interface CommitFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}

const CommitField: React.FC<CommitFieldProps> = ({
  label,
  value,
  placeholder,
  multiline = false,
  onCommit,
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => setLocalValue(value), [value]);

  const commit = () => {
    if (localValue !== value) onCommit(localValue);
  };

  return (
    <label className="design-inspector__field">
      <span className="design-inspector__field-label">{label}</span>
      {multiline ? (
        <textarea
          className="design-inspector__textarea"
          value={localValue}
          placeholder={placeholder}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={commit}
          rows={3}
        />
      ) : (
        <input
          className="design-inspector__input"
          value={localValue}
          placeholder={placeholder}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      )}
    </label>
  );
};

const NODE_TYPE_OPTIONS: readonly { value: ProposedNodeType; label: string }[] = [
  { value: 'module', label: 'Módulo' },
  { value: 'container', label: 'Contenedor' },
  { value: 'external-system', label: 'Sistema externo' },
  { value: 'actor', label: 'Actor' },
];

const EDGE_TYPE_OPTIONS: readonly { value: EdgeType; label: string }[] = [
  { value: 'dependency', label: 'Dependencia' },
  { value: 'containment', label: 'Contención' },
  { value: 'inheritance', label: 'Herencia' },
  { value: 'invocation', label: 'Invocación' },
  { value: 'external-call', label: 'Llamada externa' },
];

const COMMON_PROPERTIES: Record<ProposedNodeType, readonly string[]> = {
  module: ['responsibility', 'language', 'moduleType'],
  container: ['description', 'technology', 'containerType'],
  'external-system': ['description', 'protocol', 'systemType'],
  actor: ['description', 'role'],
};

function scalarValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function getEditablePropertyKeys(node: ProposedNode): string[] {
  const keys = new Set(COMMON_PROPERTIES[node.nodeType]);
  for (const [key, value] of Object.entries(node.properties)) {
    if (
      value === null ||
      ['string', 'number', 'boolean', 'undefined'].includes(typeof value)
    ) {
      keys.add(key);
    }
  }
  return [...keys];
}

export const DesignInspector: React.FC = () => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const selectedNodeIds = useDesignStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDesignStore((state) => state.selectedEdgeIds);
  const updateMetadata = useDesignStore((state) => state.updateMetadata);
  const updateNode = useDesignStore((state) => state.updateNode);
  const updateEdge = useDesignStore((state) => state.updateEdge);
  const removeNodes = useDesignStore((state) => state.removeNodes);
  const removeEdges = useDesignStore((state) => state.removeEdges);

  const selectedNodes = useMemo(
    () =>
      currentDesign?.nodes.filter((node) => selectedNodeIds.includes(node.id)) ?? [],
    [currentDesign, selectedNodeIds]
  );
  const selectedEdges = useMemo(
    () =>
      currentDesign?.edges.filter((edge) => selectedEdgeIds.includes(edge.id)) ?? [],
    [currentDesign, selectedEdgeIds]
  );

  if (!currentDesign) {
    return (
      <aside className="design-inspector design-inspector--empty">
        <p className="design-inspector__message">Abre un diseño para editar sus propiedades.</p>
      </aside>
    );
  }

  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0
    ? selectedNodes[0]
    : null;
  const selectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0
    ? selectedEdges[0]
    : null;
  const multipleSelection = selectedNodes.length + selectedEdges.length > 1;

  return (
    <aside className="design-inspector" aria-label="Inspector de propiedades">
      <section className="design-inspector__section">
        <header className="design-inspector__section-header">
          <h2 className="design-inspector__title">Diseño</h2>
          <span className="design-inspector__revision">Rev. {currentDesign.revision}</span>
        </header>
        <CommitField
          label="Nombre"
          value={currentDesign.name}
          onCommit={(name) => updateMetadata({ name: name.trim() || currentDesign.name })}
        />
        <CommitField
          label="Descripción"
          value={currentDesign.description ?? ''}
          placeholder="Objetivo y alcance del diseño"
          multiline
          onCommit={(description) => updateMetadata({ description: description.trim() || null })}
        />
        <dl className="design-inspector__facts">
          <div className="design-inspector__fact">
            <dt className="design-inspector__fact-label">Base</dt>
            <dd className="design-inspector__fact-value">
              {currentDesign.basedOnAnalysisRunId ?? 'Diseño desde cero'}
            </dd>
          </div>
          <div className="design-inspector__fact">
            <dt className="design-inspector__fact-label">Elementos</dt>
            <dd className="design-inspector__fact-value">
              {currentDesign.nodes.length} nodos · {currentDesign.edges.length} aristas
            </dd>
          </div>
        </dl>
      </section>

      <section className="design-inspector__section">
        <header className="design-inspector__section-header">
          <h2 className="design-inspector__title">Selección</h2>
        </header>

        {!selectedNode && !selectedEdge && !multipleSelection && (
          <p className="design-inspector__message">
            Selecciona un nodo o una arista para editarlo.
          </p>
        )}

        {multipleSelection && (
          <div className="design-inspector__multiple">
            <p className="design-inspector__message">
              {selectedNodes.length} nodos y {selectedEdges.length} aristas seleccionados.
            </p>
            <button
              type="button"
              className="design-inspector__delete"
              onClick={() => {
                removeNodes(selectedNodeIds);
                removeEdges(selectedEdgeIds);
              }}
            >
              <Trash2 aria-hidden="true" />
              <span>Eliminar selección</span>
            </button>
          </div>
        )}

        {selectedNode && (
          <div className="design-inspector__selection-editor">
            <div className="design-inspector__selection-heading">
              <span className={`design-inspector__origin design-inspector__origin--${selectedNode.origin}`}>
                {selectedNode.origin === 'imported' ? 'Importado' : 'Propuesto'}
              </span>
              {selectedNode.modified && (
                <span className="design-inspector__modified">Modificado</span>
              )}
            </div>

            <CommitField
              label="Etiqueta"
              value={selectedNode.label}
              onCommit={(label) =>
                updateNode(selectedNode.id, { label: label.trim() || selectedNode.label })
              }
            />

            <label className="design-inspector__field">
              <span className="design-inspector__field-label">Tipo de nodo</span>
              <select
                className="design-inspector__select"
                value={selectedNode.nodeType}
                onChange={(event) =>
                  updateNode(selectedNode.id, {
                    nodeType: event.target.value as ProposedNodeType,
                  })
                }
              >
                {NODE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="design-inspector__properties">
              <h3 className="design-inspector__subtitle">Propiedades comunes</h3>
              {getEditablePropertyKeys(selectedNode).map((key) => (
                <CommitField
                  key={key}
                  label={key}
                  value={scalarValue(selectedNode.properties[key])}
                  onCommit={(value) =>
                    updateNode(selectedNode.id, {
                      properties: { ...selectedNode.properties, [key]: value },
                    })
                  }
                />
              ))}
            </div>

            <button
              type="button"
              className="design-inspector__delete"
              onClick={() => removeNodes([selectedNode.id])}
            >
              <Trash2 aria-hidden="true" />
              <span>Eliminar nodo</span>
            </button>
          </div>
        )}

        {selectedEdge && (
          <div className="design-inspector__selection-editor">
            <div className="design-inspector__selection-heading">
              <span className={`design-inspector__origin design-inspector__origin--${selectedEdge.origin}`}>
                {selectedEdge.origin === 'imported' ? 'Importada' : 'Propuesta'}
              </span>
              {selectedEdge.modified && (
                <span className="design-inspector__modified">Modificada</span>
              )}
            </div>

            <label className="design-inspector__field">
              <span className="design-inspector__field-label">Tipo de arista</span>
              <select
                className="design-inspector__select"
                value={selectedEdge.edgeType}
                onChange={(event) =>
                  updateEdge(selectedEdge.id, {
                    edgeType: event.target.value as EdgeType,
                  })
                }
              >
                {EDGE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <CommitField
              label="Etiqueta"
              value={selectedEdge.label ?? ''}
              placeholder="Describe la relación"
              onCommit={(label) => updateEdge(selectedEdge.id, { label: label.trim() || undefined })}
            />

            <dl className="design-inspector__facts">
              <div className="design-inspector__fact">
                <dt className="design-inspector__fact-label">Origen</dt>
                <dd className="design-inspector__fact-value">{selectedEdge.source}</dd>
              </div>
              <div className="design-inspector__fact">
                <dt className="design-inspector__fact-label">Destino</dt>
                <dd className="design-inspector__fact-value">{selectedEdge.target}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="design-inspector__delete"
              onClick={() => removeEdges([selectedEdge.id])}
            >
              <Trash2 aria-hidden="true" />
              <span>Eliminar arista</span>
            </button>
          </div>
        )}
      </section>
    </aside>
  );
};
