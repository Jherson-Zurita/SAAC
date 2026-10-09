import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Box,
  Braces,
  CircleDot,
  Cpu,
  Database,
  FileCode2,
  FolderTree,
  Globe,
  HardDrive,
  Layers3,
  Network,
  Server,
  User,
} from 'lucide-react';
import type { C4Node } from '../../../shared/types';
import { getModuleGroupColor } from '../../lib/color-utils';

export interface C4NodeData extends Record<string, unknown> {
  node: C4Node;
  variant: string;
  drillable: boolean;
}

interface ElementPresentation {
  icon: React.ElementType;
  variant: string;
}

function getPresentation(elementType: string): ElementPresentation {
  const normalizedType = elementType.toLowerCase();

  if (normalizedType === 'person') return { icon: User, variant: 'person' };
  if (normalizedType.includes('external system')) return { icon: Globe, variant: 'external' };
  if (normalizedType.includes('software system')) return { icon: Server, variant: 'system' };
  if (normalizedType.includes('container')) return { icon: Box, variant: 'container' };
  if (normalizedType.includes('component')) return { icon: Layers3, variant: 'component' };
  if (normalizedType.includes('package')) return { icon: FolderTree, variant: 'package' };
  if (normalizedType.includes('entity')) return { icon: Database, variant: 'entity' };
  if (normalizedType.includes('interface')) return { icon: Braces, variant: 'interface' };
  if (normalizedType.includes('class')) return { icon: Box, variant: 'class' };
  if (normalizedType.includes('function') || normalizedType.includes('method')) {
    return { icon: FileCode2, variant: 'code' };
  }
  if (normalizedType.includes('participant')) return { icon: CircleDot, variant: 'participant' };
  if (normalizedType.includes('database') || normalizedType.includes('data store')) {
    return { icon: HardDrive, variant: 'entity' };
  }
  if (normalizedType.includes('process')) return { icon: Cpu, variant: 'process' };
  if (normalizedType.includes('external')) return { icon: Globe, variant: 'external' };
  if (normalizedType.includes('dynamic')) return { icon: Network, variant: 'dynamic' };

  return { icon: FileCode2, variant: 'default' };
}

export function getC4NodeVariant(elementType: string): string {
  return getPresentation(elementType).variant;
}

const C4NodeCustom: React.FC<NodeProps> = ({
  data,
  selected,
  targetPosition,
  sourcePosition,
}) => {
  const { node, drillable } = data as C4NodeData;
  const presentation = getPresentation(node.elementType);
  const Icon = presentation.icon;

  // Extraer el módulo/grupo para el código de color
  const moduleGroup = node.amgNodeId || node.technology || node.label;
  const moduleColor = getModuleGroupColor(moduleGroup);

  return (
    <div
      className={`c4-node c4-node--${presentation.variant}${selected ? ' is-selected' : ''}${
        drillable ? ' is-drillable' : ''
      }`}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: moduleColor.hex,
        boxShadow: selected ? `0 0 16px -2px ${moduleColor.hex}` : undefined,
      }}
      title={drillable ? 'Doble clic para profundizar' : undefined}
    >
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        className="c4-node__handle"
        style={{ background: moduleColor.hex }}
      />

      <div className="c4-node__heading">
        <Icon className="c4-node__icon" style={{ color: moduleColor.hex }} aria-hidden="true" />
        <span className="c4-node__label">{node.label}</span>
      </div>

      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="c4-node__type">{node.elementType}</div>
        {moduleGroup && (
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded font-bold truncate max-w-[120px]"
            style={{
              color: moduleColor.hex,
              backgroundColor: moduleColor.bg,
              border: `1px solid ${moduleColor.border}`,
            }}
            title={`Grupo de Módulo: ${moduleGroup}`}
          >
            Mod: {moduleGroup.split(/[/\\:]/).pop()}
          </span>
        )}
      </div>

      {node.technology && <div className="c4-node__technology">[{node.technology}]</div>}
      {node.description && <div className="c4-node__description">{node.description}</div>}

      {drillable && <div className="c4-node__hint">Doble clic para abrir</div>}
      <Handle
        type="source"
        position={sourcePosition || Position.Right}
        className="c4-node__handle"
        style={{ background: moduleColor.hex }}
      />
    </div>
  );
};

export default memo(C4NodeCustom);
