import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  ArrowLeftRight,
  Copy,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  EdgeType,
  ProposedArchitecture,
  ProposedEdge,
  ProposedNode,
  ProposedNodeType,
} from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  EDGE_TYPE_META,
  EDGE_TYPE_OPTIONS,
  NODE_TYPE_OPTIONS,
  validateNewConnection,
} from './design-flow';

interface CommitFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  readOnly?: boolean;
  onCommit: (value: string) => void;
  onRemove?: () => void;
}

const CommitField: React.FC<CommitFieldProps> = ({
  label,
  value,
  placeholder,
  multiline = false,
  readOnly = false,
  onCommit,
  onRemove,
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => setLocalValue(value), [value]);

  const commit = () => {
    if (localValue !== value) onCommit(localValue);
  };

  return (
    <label className="design-inspector__field">
      <span className="design-inspector__field-label">
        {label}
        {onRemove && (
          <button
            type="button"
            className="design-inspector__field-remove"
            onClick={(event) => {
              event.preventDefault();
              onRemove();
            }}
            aria-label={`Quitar ${label}`}
            title={`Quitar ${label}`}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </span>
      {multiline ? (
        <textarea
          className="design-inspector__textarea"
          value={localValue}
          placeholder={placeholder}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={commit}
          rows={3}
          readOnly={readOnly}
        />
      ) : (
        <input
          className="design-inspector__input"
          value={localValue}
          placeholder={placeholder}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={commit}
          readOnly={readOnly}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setLocalValue(value);
              event.currentTarget.blur();
            }
          }}
        />
      )}
    </label>
  );
};

const COMMON_PROPERTIES: Record<ProposedNodeType, readonly string[]> = {
  module: ['responsibility', 'language', 'moduleType'],
  container: ['description', 'technology', 'containerType'],
  'external-system': ['description', 'protocol', 'systemType'],
  actor: ['description', 'role'],
};

const PROPERTY_LABELS: Record<string, string> = {
  responsibility: 'Responsabilidad',
  language: 'Lenguaje',
  moduleType: 'Tipo de módulo',
  description: 'Descripción',
  technology: 'Tecnología',
  containerType: 'Tipo de contenedor',
  protocol: 'Protocolo',
  systemType: 'Tipo de sistema',
  role: 'Rol',
  loc: 'Líneas de código (LOC)',
  lloc: 'Líneas lógicas (LLOC)',
};

const PROPERTY_PLACEHOLDERS: Record<string, string> = {
  responsibility: '¿De qué se encarga este módulo?',
  technology: 'Ej. Node.js, PostgreSQL, React',
  protocol: 'Ej. HTTPS, gRPC, AMQP',
  role: 'Ej. Administrador, cliente',
};

const READ_ONLY_PROPERTIES = new Set(['loc', 'lloc']);
const MULTILINE_PROPERTIES = new Set(['responsibility', 'description']);

function scalarValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function coerceLike(previous: unknown, raw: string): unknown {
  if (typeof previous === 'number') {
    const parsed = Number(raw);
    return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : raw;
  }
  if (typeof previous === 'boolean') {
    if (raw.trim().toLowerCase() === 'true') return true;
    if (raw.trim().toLowerCase() === 'false') return false;
  }
  return raw;
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

const NodeLink: React.FC<{ design: ProposedArchitecture; nodeId: string }> = ({
  design,
  nodeId,
}) => {
  const focusNodes = useDesignStore((state) => state.focusNodes);
  const label = design.nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
  return (
    <button
      type="button"
      className="design-inspector__link"
      onClick={() => focusNodes([nodeId])}
      title="Ir al componente"
    >
      {label}
    </button>
  );
};

const ConnectionList: React.FC<{
  design: ProposedArchitecture;
  title: string;
  edges: ProposedEdge[];
  direction: 'in' | 'out';
}> = ({ design, title, edges, direction }) => {
  const focusNodes = useDesignStore((state) => state.focusNodes);
  if (edges.length === 0) return null;
  return (
    <div className="design-inspector__connections">
      <h4 className="design-inspector__connections-title">
        {title} <span>{edges.length}</span>
      </h4>
      <ul className="design-inspector__connection-list">
        {edges.slice(0, 12).map((edge) => {
          const otherId = direction === 'out' ? edge.target : edge.source;
          const other = design.nodes.find((node) => node.id === otherId);
          const meta = EDGE_TYPE_META[edge.edgeType];
          return (
            <li key={edge.id}>
              <button
                type="button"
                className="design-inspector__connection"
                onClick={() => focusNodes([], [edge.id])}
                title={edge.label ?? meta.label}
              >
                <span
                  className="design-inspector__connection-dot"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <span className="design-inspector__connection-label">
                  {other?.label ?? otherId}
                </span>
                <span className="design-inspector__connection-type">{meta.label}</span>
              </button>
            </li>
          );
        })}
        {edges.length > 12 && (
          <li className="design-inspector__connection-more">+{edges.length - 12} más</li>
        )}
      </ul>
    </div>
  );
};

const NewPropertyForm: React.FC<{ existingKeys: string[]; onAdd: (key: string, value: string) => void }> = ({
  existingKeys,
  onAdd,
}) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const trimmedKey = key.trim();
  const duplicate = existingKeys.includes(trimmedKey);

  const submit = () => {
    if (!trimmedKey || duplicate) return;
    onAdd(trimmedKey, value);
    setKey('');
    setValue('');
  };

  return (
    <div className="design-inspector__new-property">
      <input
        className="design-inspector__input"
        value={key}
        placeholder="Propiedad"
        aria-label="Nombre de la nueva propiedad"
        onChange={(event) => setKey(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      <input
        className="design-inspector__input"
        value={value}
        placeholder="Valor"
        aria-label="Valor de la nueva propiedad"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      <button
        type="button"
        className="design-inspector__icon-button"
        onClick={submit}
        disabled={!trimmedKey || duplicate}
        title={duplicate ? 'La propiedad ya existe' : 'Añadir propiedad'}
        aria-label="Añadir propiedad"
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
};

export const DesignInspector: React.FC = () => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const selectedNodeIds = useDesignStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDesignStore((state) => state.selectedEdgeIds);
  const updateMetadata = useDesignStore((state) => state.updateMetadata);
  const updateNode = useDesignStore((state) => state.updateNode);
  const updateEdge = useDesignStore((state) => state.updateEdge);
  const moveNodes = useDesignStore((state) => state.moveNodes);
  const removeNodes = useDesignStore((state) => state.removeNodes);
  const removeEdges = useDesignStore((state) => state.removeEdges);
  const removeSelection = useDesignStore((state) => state.removeSelection);
  const duplicateSelection = useDesignStore((state) => state.duplicateSelection);
  const [edgeError, setEdgeError] = useState<string | null>(null);

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

  useEffect(() => setEdgeError(null), [selectedEdgeIds]);

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

  const alignNodes = (axis: 'x' | 'y') => {
    const value = Math.min(...selectedNodes.map((node) => node.position[axis]));
    moveNodes(
      Object.fromEntries(
        selectedNodes.map((node) => [node.id, { ...node.position, [axis]: value }])
      )
    );
  };

  const distributeNodes = (axis: 'x' | 'y') => {
    const sorted = [...selectedNodes].sort((a, b) => a.position[axis] - b.position[axis]);
    const first = sorted[0].position[axis];
    const last = sorted[sorted.length - 1].position[axis];
    const step = sorted.length > 1 ? (last - first) / (sorted.length - 1) : 0;
    moveNodes(
      Object.fromEntries(
        sorted.map((node, index) => [
          node.id,
          { ...node.position, [axis]: first + step * index },
        ])
      )
    );
  };

  const updateProperty = (node: ProposedNode, key: string, raw: string) => {
    const properties = { ...node.properties };
    if (raw.trim() === '' && typeof node.properties[key] !== 'number') {
      delete properties[key];
    } else {
      properties[key] = coerceLike(node.properties[key], raw);
    }
    updateNode(node.id, { properties });
  };

  const removeProperty = (node: ProposedNode, key: string) => {
    const properties = { ...node.properties };
    delete properties[key];
    updateNode(node.id, { properties });
  };

  const reverseEdge = (edge: ProposedEdge) => {
    const error = validateNewConnection(
      currentDesign,
      edge.target,
      edge.source,
      edge.edgeType,
      edge.id
    );
    if (error) {
      setEdgeError(error);
      return;
    }
    setEdgeError(null);
    updateEdge(edge.id, { source: edge.target, target: edge.source });
  };

  const changeEdgeType = (edge: ProposedEdge, edgeType: EdgeType) => {
    const error = validateNewConnection(
      currentDesign,
      edge.source,
      edge.target,
      edgeType,
      edge.id
    );
    if (error) {
      setEdgeError(error);
      return;
    }
    setEdgeError(null);
    updateEdge(edge.id, { edgeType });
  };

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
          <div className="design-inspector__fact">
            <dt className="design-inspector__fact-label">Propuestos</dt>
            <dd className="design-inspector__fact-value">
              {currentDesign.nodes.filter((node) => node.origin === 'proposed').length} nodos ·{' '}
              {currentDesign.nodes.filter((node) => node.modified).length} modificados
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
            Selecciona un nodo o una arista para editarlo. Usa Shift + arrastrar para seleccionar varios.
          </p>
        )}

        {multipleSelection && (
          <div className="design-inspector__multiple">
            <p className="design-inspector__message">
              {selectedNodes.length} nodos y {selectedEdges.length} aristas seleccionados.
            </p>
            {selectedNodes.length > 1 && (
              <div className="design-inspector__button-row" role="group" aria-label="Alinear">
                <button
                  type="button"
                  className="design-inspector__secondary"
                  onClick={() => alignNodes('x')}
                  title="Alinear a la izquierda"
                >
                  <AlignHorizontalJustifyStart aria-hidden="true" />
                  <span>Alinear X</span>
                </button>
                <button
                  type="button"
                  className="design-inspector__secondary"
                  onClick={() => alignNodes('y')}
                  title="Alinear arriba"
                >
                  <AlignVerticalJustifyStart aria-hidden="true" />
                  <span>Alinear Y</span>
                </button>
              </div>
            )}
            {selectedNodes.length > 2 && (
              <div className="design-inspector__button-row" role="group" aria-label="Distribuir">
                <button
                  type="button"
                  className="design-inspector__secondary"
                  onClick={() => distributeNodes('x')}
                >
                  <span>Distribuir horizontal</span>
                </button>
                <button
                  type="button"
                  className="design-inspector__secondary"
                  onClick={() => distributeNodes('y')}
                >
                  <span>Distribuir vertical</span>
                </button>
              </div>
            )}
            {selectedNodes.length > 0 && (
              <button
                type="button"
                className="design-inspector__secondary"
                onClick={() => duplicateSelection()}
                title="Duplicar selección (Ctrl+D)"
              >
                <Copy aria-hidden="true" />
                <span>Duplicar selección</span>
              </button>
            )}
            <button
              type="button"
              className="design-inspector__delete"
              onClick={removeSelection}
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
              <h3 className="design-inspector__subtitle">Propiedades</h3>
              {getEditablePropertyKeys(selectedNode).map((key) => {
                const isCommon = COMMON_PROPERTIES[selectedNode.nodeType].includes(key);
                return (
                  <CommitField
                    key={key}
                    label={PROPERTY_LABELS[key] ?? key}
                    value={scalarValue(selectedNode.properties[key])}
                    placeholder={PROPERTY_PLACEHOLDERS[key]}
                    multiline={MULTILINE_PROPERTIES.has(key)}
                    readOnly={READ_ONLY_PROPERTIES.has(key)}
                    onCommit={(value) => updateProperty(selectedNode, key, value)}
                    onRemove={
                      isCommon || READ_ONLY_PROPERTIES.has(key)
                        ? undefined
                        : () => removeProperty(selectedNode, key)
                    }
                  />
                );
              })}
              <NewPropertyForm
                existingKeys={getEditablePropertyKeys(selectedNode)}
                onAdd={(key, value) =>
                  updateNode(selectedNode.id, {
                    properties: { ...selectedNode.properties, [key]: value },
                  })
                }
              />
            </div>

            <div className="design-inspector__properties">
              <h3 className="design-inspector__subtitle">Conexiones</h3>
              <ConnectionList
                design={currentDesign}
                title="Salientes"
                direction="out"
                edges={currentDesign.edges.filter((edge) => edge.source === selectedNode.id)}
              />
              <ConnectionList
                design={currentDesign}
                title="Entrantes"
                direction="in"
                edges={currentDesign.edges.filter((edge) => edge.target === selectedNode.id)}
              />
              {!currentDesign.edges.some(
                (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id
              ) && (
                <p className="design-inspector__hint">
                  Sin conexiones. Arrastra desde el punto derecho del nodo hacia otro componente.
                </p>
              )}
            </div>

            <div className="design-inspector__button-row">
              <button
                type="button"
                className="design-inspector__secondary"
                onClick={() => duplicateSelection()}
                title="Duplicar (Ctrl+D)"
              >
                <Copy aria-hidden="true" />
                <span>Duplicar</span>
              </button>
              <button
                type="button"
                className="design-inspector__delete design-inspector__delete--inline"
                onClick={() => removeNodes([selectedNode.id])}
              >
                <Trash2 aria-hidden="true" />
                <span>Eliminar</span>
              </button>
            </div>
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

            <div className="design-inspector__route">
              <NodeLink design={currentDesign} nodeId={selectedEdge.source} />
              <span className="design-inspector__route-arrow" aria-hidden="true">→</span>
              <NodeLink design={currentDesign} nodeId={selectedEdge.target} />
            </div>

            <label className="design-inspector__field">
              <span className="design-inspector__field-label">Tipo de arista</span>
              <select
                className="design-inspector__select"
                value={selectedEdge.edgeType}
                onChange={(event) => changeEdgeType(selectedEdge, event.target.value as EdgeType)}
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

            {edgeError && (
              <p className="design-inspector__error" role="alert">{edgeError}</p>
            )}

            <div className="design-inspector__button-row">
              <button
                type="button"
                className="design-inspector__secondary"
                onClick={() => reverseEdge(selectedEdge)}
                title="Intercambiar origen y destino"
              >
                <ArrowLeftRight aria-hidden="true" />
                <span>Invertir</span>
              </button>
              <button
                type="button"
                className="design-inspector__delete design-inspector__delete--inline"
                onClick={() => removeEdges([selectedEdge.id])}
              >
                <Trash2 aria-hidden="true" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
};
