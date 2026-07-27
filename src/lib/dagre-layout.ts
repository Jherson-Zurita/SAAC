import dagre from '@dagrejs/dagre';
import { Node, Edge, Position } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  nodesep?: number;
  ranksep?: number;
}

export function getLayoutedElements<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node<T>[]; edges: Edge[] } {
  const {
    direction = 'LR',
    nodeWidth = 220,
    nodeHeight = 90,
    nodesep = 40,
    ranksep = 60,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR' || direction === 'RL';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
  });

  nodes.forEach((node) => {
    const width = (node.width as number) || nodeWidth;
    const height = (node.height as number) || nodeHeight;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = (node.width as number) || nodeWidth;
    const height = (node.height as number) || nodeHeight;

    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}
