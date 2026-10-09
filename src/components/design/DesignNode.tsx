import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Boxes, Globe2, UserRound } from 'lucide-react';
import type { ProposedNodeType } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import { getNodeSubtitle, NODE_TYPE_LABELS, type DesignNodeData } from './design-flow';

const NODE_ICONS: Record<ProposedNodeType, React.ElementType> = {
  module: Boxes,
  container: Box,
  'external-system': Globe2,
  actor: UserRound,
};

const InlineLabelEditor: React.FC<{ nodeId: string; label: string }> = ({ nodeId, label }) => {
  const updateNode = useDesignStore((state) => state.updateNode);
  const setEditingNode = useDesignStore((state) => state.setEditingNode);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (shouldCommit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const next = value.trim();
    if (shouldCommit && next && next !== label) updateNode(nodeId, { label: next });
    setEditingNode(null);
  };

  return (
    <input
      ref={inputRef}
      className="design-node__label-input nodrag nopan"
      value={value}
      aria-label="Nombre del componente"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      }}
    />
  );
};

const DesignNode: React.FC<NodeProps> = ({
  data,
  selected,
  targetPosition,
  sourcePosition,
}) => {
  const { node, dimmed } = data as DesignNodeData;
  const isEditing = useDesignStore((state) => state.editingNodeId === node.id);
  const Icon = NODE_ICONS[node.nodeType];
  const typeLabel = NODE_TYPE_LABELS[node.nodeType];
  const subtitle = getNodeSubtitle(node);

  const className = [
    'design-node',
    `design-node--${node.nodeType}`,
    `design-node--${node.origin}`,
    node.modified ? 'design-node--modified' : '',
    selected ? 'design-node--selected' : '',
    dimmed ? 'design-node--dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={className}
      aria-label={`${typeLabel}: ${node.label}`}
      title={isEditing ? undefined : 'Doble clic para renombrar'}
    >
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        className="design-node__handle design-node__handle--target"
      />

      <header className="design-node__header">
        <Icon className="design-node__icon" aria-hidden="true" />
        {isEditing ? (
          <InlineLabelEditor nodeId={node.id} label={node.label} />
        ) : (
          <span className="design-node__label">{node.label}</span>
        )}
      </header>

      {subtitle && <p className="design-node__subtitle">{subtitle}</p>}

      <div className="design-node__meta">
        <span className="design-node__type">{typeLabel}</span>
        <span className={`design-node__origin design-node__origin--${node.origin}`}>
          {node.origin === 'imported' ? 'Importado' : 'Propuesto'}
        </span>
        {node.modified && <span className="design-node__modified">Modificado</span>}
      </div>

      <Handle
        type="source"
        position={sourcePosition || Position.Right}
        className="design-node__handle design-node__handle--source"
      />
    </article>
  );
};

export default memo(DesignNode);
