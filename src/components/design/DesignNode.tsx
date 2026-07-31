import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Boxes, Globe2, UserRound } from 'lucide-react';
import type { ProposedNodeType } from '../../../shared/types';
import type { DesignNodeData } from './design-flow';

const NODE_PRESENTATION: Record<
  ProposedNodeType,
  { icon: React.ElementType; label: string }
> = {
  module: { icon: Boxes, label: 'Módulo' },
  container: { icon: Box, label: 'Contenedor' },
  'external-system': { icon: Globe2, label: 'Sistema externo' },
  actor: { icon: UserRound, label: 'Actor' },
};

const DesignNode: React.FC<NodeProps> = ({
  data,
  selected,
  targetPosition,
  sourcePosition,
}) => {
  const { node } = data as DesignNodeData;
  const presentation = NODE_PRESENTATION[node.nodeType];
  const Icon = presentation.icon;

  const className = [
    'design-node',
    `design-node--${node.nodeType}`,
    `design-node--${node.origin}`,
    node.modified ? 'design-node--modified' : '',
    selected ? 'design-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className} aria-label={`${presentation.label}: ${node.label}`}>
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        className="design-node__handle design-node__handle--target"
      />

      <header className="design-node__header">
        <Icon className="design-node__icon" aria-hidden="true" />
        <span className="design-node__label">{node.label}</span>
      </header>

      <div className="design-node__meta">
        <span className="design-node__type">{presentation.label}</span>
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
