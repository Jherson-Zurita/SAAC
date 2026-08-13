import React, { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import { Download } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { C4DiagramData, C4Node } from '../../../shared/types';
import { getLayoutedElements } from '../../lib/dagre-layout';
import C4NodeCustom, { getC4NodeVariant, type C4NodeData } from './C4NodeCustom';
import { NodeContextMenu } from './NodeContextMenu';

interface C4CanvasProps {
  diagramData: C4DiagramData;
  title: string;
  direction?: 'LR' | 'TB';
  onNodeClick?: (node: C4Node) => void;
  onNodeDoubleClick?: (node: C4Node) => void;
  isNodeDrillable?: (node: C4Node) => boolean;
}

const nodeTypes: NodeTypes = {
  person: C4NodeCustom,
  system: C4NodeCustom,
  external: C4NodeCustom,
  container: C4NodeCustom,
  component: C4NodeCustom,
  package: C4NodeCustom,
  entity: C4NodeCustom,
  interface: C4NodeCustom,
  class: C4NodeCustom,
  code: C4NodeCustom,
  participant: C4NodeCustom,
  process: C4NodeCustom,
  dynamic: C4NodeCustom,
  default: C4NodeCustom,
};

function createExportFilename(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug || 'diagrama'}.json`;
}

export const C4Canvas: React.FC<C4CanvasProps> = ({
  diagramData,
  title,
  direction = 'LR',
  onNodeClick,
  onNodeDoubleClick,
  isNodeDrillable = () => false,
}) => {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const rawNodes: Node<C4NodeData>[] = diagramData.nodes.map((node) => ({
      id: node.id,
      type: getC4NodeVariant(node.elementType),
      position: { x: 0, y: 0 },
      data: {
        node,
        variant: getC4NodeVariant(node.elementType),
        drillable: isNodeDrillable(node),
      },
      ariaLabel: `${node.elementType}: ${node.label}`,
    }));

    const rawEdges: Edge[] = diagramData.edges.map((edge, index) => ({
      id: `c4-edge-${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      animated: Boolean(edge.protocol),
      className: 'c4-edge',
      style: { stroke: 'var(--accent-blue)', strokeWidth: 1.5 },
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: 'var(--panel-dark)', fillOpacity: 0.92 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--accent-blue)',
        width: 14,
        height: 14,
      },
    }));

    return getLayoutedElements(rawNodes, rawEdges, {
      direction,
      nodeWidth: 220,
      nodeHeight: 112,
      nodesep: 52,
      ranksep: 88,
    });
  }, [diagramData, direction, isNodeDrillable]);

  const [contextNode, setContextNode] = React.useState<{
    node: C4Node;
    pos: { x: number; y: number };
  } | null>(null);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<C4NodeData>) => {
      onNodeClick?.(node.data.node);
      setContextNode({
        node: node.data.node,
        pos: { x: event.clientX, y: event.clientY },
      });
    },
    [onNodeClick]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<C4NodeData>) => {
      event.preventDefault();
      setContextNode({
        node: node.data.node,
        pos: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<C4NodeData>) => {
      if (node.data.drillable) onNodeDoubleClick?.(node.data.node);
    },
    [onNodeDoubleClick]
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(diagramData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = createExportFilename(title);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [diagramData, title]);

  return (
    <section className="c4-canvas" aria-label={title}>
      <div className="c4-canvas__heading">
        <span>{title}</span>
        <span className="c4-canvas__count">
          {diagramData.nodes.length} nodos · {diagramData.edges.length} aristas
        </span>
      </div>

      <button
        type="button"
        onClick={handleExport}
        className="c4-canvas__export"
        title="Exportar diagrama activo como JSON"
        aria-label="Exportar diagrama activo como JSON"
      >
        <Download aria-hidden="true" />
        <span>JSON</span>
      </button>

      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        attributionPosition="bottom-right"
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background color="var(--diagram-grid)" gap={20} />
        <Controls className="c4-flow-control" />
        <MiniMap
          nodeColor="var(--accent-blue)"
          maskColor="var(--diagram-minimap-mask)"
          className="c4-flow-minimap"
        />
      </ReactFlow>

      {contextNode && (
        <NodeContextMenu
          node={contextNode.node}
          position={contextNode.pos}
          onClose={() => setContextNode(null)}
        />
      )}
    </section>
  );
};
