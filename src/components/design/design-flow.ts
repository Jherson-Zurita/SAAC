import {
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';
import type {
  EdgeType,
  ExportFormat,
  ProposedArchitecture,
  ProposedEdge,
  ProposedNode,
  ProposedNodeType,
} from '../../../shared/types';
import { getLayoutedElements } from '../../lib/dagre-layout';

export const DESIGN_NODE_MIME = 'application/saac-design-node';

const NODE_TYPES: readonly ProposedNodeType[] = [
  'module',
  'container',
  'external-system',
  'actor',
];

export interface DesignNodeData extends Record<string, unknown> {
  node: ProposedNode;
}

export interface DesignEdgeData extends Record<string, unknown> {
  edge: ProposedEdge;
}

export type DesignFlowNode = Node<DesignNodeData, 'design'>;
export type DesignFlowEdge = Edge<DesignEdgeData>;

export interface DesignNodeDragPayload {
  nodeType: ProposedNodeType;
}

export function isProposedNodeType(value: unknown): value is ProposedNodeType {
  return typeof value === 'string' && NODE_TYPES.includes(value as ProposedNodeType);
}

export function createNodeDragPayload(nodeType: ProposedNodeType): string {
  return JSON.stringify({ nodeType } satisfies DesignNodeDragPayload);
}

export function parseNodeDragPayload(value: string): DesignNodeDragPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<DesignNodeDragPayload>;
    return isProposedNodeType(parsed.nodeType) ? { nodeType: parsed.nodeType } : null;
  } catch {
    return isProposedNodeType(value) ? { nodeType: value } : null;
  }
}

export function getDefaultNodeLabel(nodeType: ProposedNodeType): string {
  switch (nodeType) {
    case 'module':
      return 'Nuevo módulo';
    case 'container':
      return 'Nuevo contenedor';
    case 'external-system':
      return 'Sistema externo';
    case 'actor':
      return 'Nuevo actor';
  }
}

export function toFlowNodes(
  nodes: ProposedNode[],
  selectedNodeIds: readonly string[]
): DesignFlowNode[] {
  const selected = new Set(selectedNodeIds);
  return nodes.map((node) => ({
    id: node.id,
    type: 'design',
    position: {
      x: Number.isFinite(node.position?.x) ? node.position.x : 0,
      y: Number.isFinite(node.position?.y) ? node.position.y : 0,
    },
    data: { node },
    selected: selected.has(node.id),
    draggable: true,
    connectable: true,
    selectable: true,
    ariaLabel: `${node.nodeType}: ${node.label}`,
    className: `design-flow-node design-flow-node--${node.nodeType}`,
  }));
}

export function toFlowEdges(
  edges: ProposedEdge[],
  selectedEdgeIds: readonly string[]
): DesignFlowEdge[] {
  const selected = new Set(selectedEdgeIds);
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.edgeType,
    data: { edge },
    selected: selected.has(edge.id),
    selectable: true,
    className: `design-edge design-edge--${edge.origin}${edge.modified ? ' design-edge--modified' : ''}`,
    style: {
      stroke: 'var(--design-edge-color, var(--accent-blue))',
      strokeWidth: 1.5,
    },
    labelStyle: {
      fill: 'var(--design-edge-label, var(--text-secondary))',
      fontSize: 11,
      fontWeight: 500,
    },
    labelBgStyle: {
      fill: 'var(--design-edge-label-bg, var(--panel-dark))',
      fillOpacity: 0.94,
    },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'var(--design-edge-color, var(--accent-blue))',
      width: 16,
      height: 16,
    },
  }));
}

function createsDirectedCycle(
  design: ProposedArchitecture,
  source: string,
  target: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of design.edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }

  const pending = [target];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === source) return true;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }

  return false;
}

export function validateNewConnection(
  design: ProposedArchitecture,
  source: string,
  target: string,
  edgeType: EdgeType
): string | null {
  if (source === target) {
    return 'No se permiten conexiones de un nodo consigo mismo.';
  }

  if (!design.nodes.some((node) => node.id === source)) {
    return 'El nodo de origen ya no existe.';
  }

  if (!design.nodes.some((node) => node.id === target)) {
    return 'El nodo de destino ya no existe.';
  }

  const duplicate = design.edges.some(
    (edge) =>
      edge.source === source && edge.target === target && edge.edgeType === edgeType
  );
  if (duplicate) {
    return 'Ya existe una conexión del mismo tipo entre estos nodos.';
  }

  if (createsDirectedCycle(design, source, target)) {
    return 'La conexión generaría un ciclo en la arquitectura propuesta.';
  }

  return null;
}

export function layoutDesignElements(
  nodes: DesignFlowNode[],
  edges: DesignFlowEdge[]
): { nodes: DesignFlowNode[]; edges: DesignFlowEdge[] } {
  const layouted = getLayoutedElements(nodes, edges, {
    direction: 'LR',
    nodeWidth: 224,
    nodeHeight: 112,
    nodesep: 56,
    ranksep: 92,
  });
  return {
    nodes: layouted.nodes as DesignFlowNode[],
    edges: layouted.edges as DesignFlowEdge[],
  };
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'structurizr-dsl':
      return 'dsl';
    case 'plant-uml':
      return 'puml';
    case 'mermaid':
      return 'mmd';
  }
}

export function downloadDesignText(
  designName: string,
  format: ExportFormat,
  content: string
): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(designName) || 'arquitectura-propuesta'}.${getExportExtension(format)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
