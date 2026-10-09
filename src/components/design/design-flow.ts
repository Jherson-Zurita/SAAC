import {
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';
import type {
  EdgeType,
  ExportFormat,
  NodePosition,
  ProposedArchitecture,
  ProposedEdge,
  ProposedNode,
  ProposedNodeType,
} from '../../../shared/types';
import { getLayoutedElements } from '../../lib/dagre-layout';

export const DESIGN_NODE_MIME = 'application/saac-design-node';
export const DESIGN_TEMPLATE_MIME = 'application/saac-design-template';

const NODE_TYPES: readonly ProposedNodeType[] = [
  'module',
  'container',
  'external-system',
  'actor',
];

export const NODE_TYPE_LABELS: Record<ProposedNodeType, string> = {
  module: 'Módulo',
  container: 'Contenedor',
  'external-system': 'Sistema externo',
  actor: 'Actor',
};

export interface EdgeTypeMeta {
  label: string;
  color: string;
  dash?: string;
  description: string;
}

export const EDGE_TYPE_META: Record<EdgeType, EdgeTypeMeta> = {
  dependency: {
    label: 'Dependencia',
    color: '#3b82f6',
    description: 'Usa o importa al destino',
  },
  invocation: {
    label: 'Invocación',
    color: '#8b5cf6',
    description: 'Llama en tiempo de ejecución',
  },
  containment: {
    label: 'Contención',
    color: '#64748b',
    dash: '2 4',
    description: 'El origen contiene al destino',
  },
  inheritance: {
    label: 'Herencia',
    color: '#10b981',
    dash: '8 4',
    description: 'Extiende o implementa al destino',
  },
  'external-call': {
    label: 'Llamada externa',
    color: '#f59e0b',
    dash: '6 3',
    description: 'Comunicación con un sistema externo',
  },
};

export const EDGE_TYPE_OPTIONS: readonly { value: EdgeType; label: string }[] = (
  Object.keys(EDGE_TYPE_META) as EdgeType[]
).map((value) => ({ value, label: EDGE_TYPE_META[value].label }));

export const NODE_TYPE_OPTIONS: readonly { value: ProposedNodeType; label: string }[] =
  NODE_TYPES.map((value) => ({ value, label: NODE_TYPE_LABELS[value] }));

export interface DesignNodeData extends Record<string, unknown> {
  node: ProposedNode;
  dimmed: boolean;
}

export interface DesignEdgeData extends Record<string, unknown> {
  edge: ProposedEdge;
}

export type DesignFlowNode = Node<DesignNodeData, 'design'>;
export type DesignFlowEdge = Edge<DesignEdgeData>;

export interface DesignNodeDragPayload {
  nodeType: ProposedNodeType;
}

/**
 * Subgrafo independiente de IDs persistidos: lo usan las plantillas,
 * el portapapeles y la duplicación. Las aristas referencian `key`.
 */
export interface DesignFragment {
  nodes: {
    key: string;
    nodeType: ProposedNodeType;
    label: string;
    position: NodePosition;
    properties: Record<string, unknown>;
  }[];
  edges: {
    source: string;
    target: string;
    edgeType: EdgeType;
    label?: string;
    properties: Record<string, unknown>;
  }[];
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

const DEFAULT_LABELS = new Set(NODE_TYPES.map(getDefaultNodeLabel));

export function isDefaultNodeLabel(label: string): boolean {
  return DEFAULT_LABELS.has(label.trim());
}

export function getNodeSubtitle(node: ProposedNode): string | null {
  for (const key of ['technology', 'responsibility', 'role', 'protocol', 'description']) {
    const value = node.properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toFlowNodes(
  nodes: ProposedNode[],
  selectedNodeIds: readonly string[],
  highlightedNodeIds: ReadonlySet<string> | null
): DesignFlowNode[] {
  const selected = new Set(selectedNodeIds);
  return nodes.map((node) => ({
    id: node.id,
    type: 'design',
    position: {
      x: Number.isFinite(node.position?.x) ? node.position.x : 0,
      y: Number.isFinite(node.position?.y) ? node.position.y : 0,
    },
    data: {
      node,
      dimmed: highlightedNodeIds !== null && !highlightedNodeIds.has(node.id),
    },
    selected: selected.has(node.id),
    draggable: true,
    connectable: true,
    selectable: true,
    ariaLabel: `${NODE_TYPE_LABELS[node.nodeType]}: ${node.label}`,
    className: `design-flow-node design-flow-node--${node.nodeType}`,
  }));
}

export function toFlowEdges(
  edges: ProposedEdge[],
  selectedNodeIds: readonly string[],
  selectedEdgeIds: readonly string[]
): DesignFlowEdge[] {
  const selected = new Set(selectedEdgeIds);
  const focusNodes = new Set(selectedNodeIds);
  const hasFocus = focusNodes.size > 0;

  return edges.map((edge) => {
    const meta = EDGE_TYPE_META[edge.edgeType] ?? EDGE_TYPE_META.dependency;
    const isSelected = selected.has(edge.id);
    const isActive =
      isSelected || (hasFocus && (focusNodes.has(edge.source) || focusNodes.has(edge.target)));
    const isDimmed = hasFocus && !isActive;
    const label = edge.label?.trim() || (isActive ? meta.label : undefined);

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label,
      data: { edge },
      selected: isSelected,
      selectable: true,
      reconnectable: true,
      animated: isActive && edge.edgeType === 'invocation',
      zIndex: isActive ? 10 : 0,
      className: [
        'design-edge',
        `design-edge--${edge.origin}`,
        `design-edge--${edge.edgeType}`,
        edge.modified ? 'design-edge--modified' : '',
        isActive ? 'design-edge--active' : '',
        isDimmed ? 'design-edge--dimmed' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        stroke: meta.color,
        strokeWidth: isActive ? 2.25 : 1.5,
        strokeDasharray: meta.dash,
        opacity: isDimmed ? 0.18 : 1,
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
        type: edge.edgeType === 'inheritance' ? MarkerType.Arrow : MarkerType.ArrowClosed,
        color: meta.color,
        width: 16,
        height: 16,
      },
    };
  });
}

function createsDirectedCycle(
  design: ProposedArchitecture,
  source: string,
  target: string,
  ignoreEdgeId?: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of design.edges) {
    if (edge.id === ignoreEdgeId) continue;
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
  edgeType: EdgeType,
  ignoreEdgeId?: string
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
      edge.id !== ignoreEdgeId &&
      edge.source === source &&
      edge.target === target &&
      edge.edgeType === edgeType
  );
  if (duplicate) {
    return 'Ya existe una conexión del mismo tipo entre estos nodos.';
  }

  if (createsDirectedCycle(design, source, target, ignoreEdgeId)) {
    return 'La conexión generaría un ciclo en la arquitectura propuesta.';
  }

  return null;
}

export function layoutDesignElements<N extends Node<Record<string, unknown>>>(
  nodes: N[],
  edges: Edge[]
): { nodes: N[]; edges: Edge[] } {
  const layouted = getLayoutedElements(nodes, edges, {
    direction: 'LR',
    nodeWidth: 224,
    nodeHeight: 112,
    nodesep: 56,
    ranksep: 92,
  });
  return {
    nodes: layouted.nodes as N[],
    edges: layouted.edges,
  };
}

/** Distribuye un fragmento con Dagre y lo desplaza para que empiece en `origin`. */
export function layoutFragment(fragment: DesignFragment, origin: NodePosition): DesignFragment {
  const layouted = layoutDesignElements(
    fragment.nodes.map((node) => ({
      id: node.key,
      position: { x: 0, y: 0 },
      data: {},
    })),
    fragment.edges.map((edge, index) => ({
      id: `fragment-edge-${index}`,
      source: edge.source,
      target: edge.target,
    }))
  );
  const positions = new Map(layouted.nodes.map((node) => [node.id, node.position]));
  const minX = Math.min(...layouted.nodes.map((node) => node.position.x));
  const minY = Math.min(...layouted.nodes.map((node) => node.position.y));

  return {
    ...fragment,
    nodes: fragment.nodes.map((node) => {
      const position = positions.get(node.key) ?? { x: 0, y: 0 };
      return {
        ...node,
        position: { x: position.x - minX + origin.x, y: position.y - minY + origin.y },
      };
    }),
  };
}

export function extractFragment(
  design: ProposedArchitecture,
  nodeIds: readonly string[]
): DesignFragment | null {
  const ids = new Set(nodeIds);
  const nodes = design.nodes.filter((node) => ids.has(node.id));
  if (nodes.length === 0) return null;

  return {
    nodes: nodes.map((node) => ({
      key: node.id,
      nodeType: node.nodeType,
      label: node.label,
      position: { ...node.position },
      properties: structuredClone(node.properties),
    })),
    edges: design.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeType,
        ...(edge.label ? { label: edge.label } : {}),
        properties: structuredClone(edge.properties),
      })),
  };
}

export function getNodesBounds(
  nodes: readonly { position: NodePosition }[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (nodes.length === 0) return null;
  return {
    minX: Math.min(...nodes.map((node) => node.position.x)),
    minY: Math.min(...nodes.map((node) => node.position.y)),
    maxX: Math.max(...nodes.map((node) => node.position.x)),
    maxY: Math.max(...nodes.map((node) => node.position.y)),
  };
}

// ── Validación arquitectónica ──

export type DesignIssueSeverity = 'error' | 'warning' | 'info';

export interface DesignIssue {
  id: string;
  severity: DesignIssueSeverity;
  title: string;
  detail: string;
  nodeIds: string[];
  edgeIds: string[];
}

const HIGH_FAN_OUT_THRESHOLD = 8;

function stronglyConnectedComponents(
  nodeIds: readonly string[],
  edges: readonly ProposedEdge[]
): string[][] {
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);

  let index = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  const visit = (root: string) => {
    const work: { node: string; next: number }[] = [{ node: root, next: 0 }];
    indices.set(root, index);
    lowLinks.set(root, index);
    index += 1;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const neighbors = adjacency.get(frame.node) ?? [];
      if (frame.next < neighbors.length) {
        const neighbor = neighbors[frame.next];
        frame.next += 1;
        if (!indices.has(neighbor)) {
          indices.set(neighbor, index);
          lowLinks.set(neighbor, index);
          index += 1;
          stack.push(neighbor);
          onStack.add(neighbor);
          work.push({ node: neighbor, next: 0 });
        } else if (onStack.has(neighbor)) {
          lowLinks.set(
            frame.node,
            Math.min(lowLinks.get(frame.node)!, indices.get(neighbor)!)
          );
        }
        continue;
      }

      work.pop();
      const parent = work[work.length - 1];
      if (parent) {
        lowLinks.set(
          parent.node,
          Math.min(lowLinks.get(parent.node)!, lowLinks.get(frame.node)!)
        );
      }
      if (lowLinks.get(frame.node) === indices.get(frame.node)) {
        const component: string[] = [];
        let member: string | undefined;
        do {
          member = stack.pop();
          if (member === undefined) break;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.node);
        if (component.length > 1) components.push(component);
      }
    }
  };

  for (const id of nodeIds) {
    if (!indices.has(id)) visit(id);
  }
  return components;
}

export function validateDesign(design: ProposedArchitecture): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const nodeById = new Map(design.nodes.map((node) => [node.id, node]));
  const labelOf = (id: string) => nodeById.get(id)?.label ?? id;
  const degree = new Map<string, number>();
  const outgoing = new Map<string, ProposedEdge[]>();
  const containmentParents = new Map<string, ProposedEdge[]>();

  for (const edge of design.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    if (edge.edgeType === 'containment') {
      const parents = containmentParents.get(edge.target) ?? [];
      parents.push(edge);
      containmentParents.set(edge.target, parents);
    } else {
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge);
      outgoing.set(edge.source, list);
    }
  }

  for (const [childId, parents] of containmentParents) {
    if (parents.length > 1) {
      issues.push({
        id: `multi-parent-${childId}`,
        severity: 'error',
        title: 'Contención múltiple',
        detail: `“${labelOf(childId)}” está contenido por ${parents.length} elementos; un componente solo debería pertenecer a un contenedor.`,
        nodeIds: [childId, ...parents.map((edge) => edge.source)],
        edgeIds: parents.map((edge) => edge.id),
      });
    }
  }

  const cycles = stronglyConnectedComponents(
    design.nodes.map((node) => node.id),
    design.edges.filter((edge) => edge.edgeType !== 'containment')
  );
  cycles.forEach((component, index) => {
    const members = new Set(component);
    issues.push({
      id: `cycle-${index}`,
      severity: 'warning',
      title: 'Dependencia circular',
      detail: `${component.length} componentes dependen entre sí: ${component
        .slice(0, 4)
        .map(labelOf)
        .join(', ')}${component.length > 4 ? '…' : ''}.`,
      nodeIds: component,
      edgeIds: design.edges
        .filter((edge) => members.has(edge.source) && members.has(edge.target))
        .map((edge) => edge.id),
    });
  });

  for (const edge of design.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;

    if (target.nodeType === 'actor' && edge.edgeType !== 'invocation') {
      issues.push({
        id: `actor-target-${edge.id}`,
        severity: 'warning',
        title: 'Actor como destino',
        detail: `“${source.label}” tiene una ${EDGE_TYPE_META[edge.edgeType].label.toLowerCase()} hacia el actor “${target.label}”. Los actores suelen iniciar interacciones, no recibirlas.`,
        nodeIds: [source.id, target.id],
        edgeIds: [edge.id],
      });
    }

    if (
      edge.edgeType === 'containment' &&
      (source.nodeType === 'actor' ||
        source.nodeType === 'external-system' ||
        (source.nodeType === 'module' && target.nodeType === 'container'))
    ) {
      issues.push({
        id: `invalid-containment-${edge.id}`,
        severity: 'warning',
        title: 'Contención incoherente',
        detail: `Un ${NODE_TYPE_LABELS[source.nodeType].toLowerCase()} (“${source.label}”) no debería contener a un ${NODE_TYPE_LABELS[target.nodeType].toLowerCase()} (“${target.label}”).`,
        nodeIds: [source.id, target.id],
        edgeIds: [edge.id],
      });
    }

    if (edge.edgeType === 'inheritance' && source.nodeType !== target.nodeType) {
      issues.push({
        id: `mixed-inheritance-${edge.id}`,
        severity: 'warning',
        title: 'Herencia entre tipos distintos',
        detail: `“${source.label}” hereda de “${target.label}”, pero son de tipos diferentes.`,
        nodeIds: [source.id, target.id],
        edgeIds: [edge.id],
      });
    }

    if (target.nodeType === 'external-system' && edge.edgeType === 'dependency') {
      issues.push({
        id: `external-dependency-${edge.id}`,
        severity: 'info',
        title: 'Dependencia directa a sistema externo',
        detail: `“${source.label}” depende directamente de “${target.label}”. Considera usar “Llamada externa” o un adaptador.`,
        nodeIds: [source.id, target.id],
        edgeIds: [edge.id],
      });
    }
  }

  for (const [nodeId, edges] of outgoing) {
    if (edges.length >= HIGH_FAN_OUT_THRESHOLD) {
      issues.push({
        id: `fan-out-${nodeId}`,
        severity: 'info',
        title: 'Acoplamiento eferente alto',
        detail: `“${labelOf(nodeId)}” depende de ${edges.length} componentes. Evalúa dividir sus responsabilidades.`,
        nodeIds: [nodeId],
        edgeIds: edges.map((edge) => edge.id),
      });
    }
  }

  const labelGroups = new Map<string, ProposedNode[]>();
  for (const node of design.nodes) {
    const key = `${node.nodeType}:${normalizeSearchText(node.label)}`;
    const group = labelGroups.get(key) ?? [];
    group.push(node);
    labelGroups.set(key, group);
  }
  for (const group of labelGroups.values()) {
    if (group.length > 1) {
      issues.push({
        id: `duplicate-label-${group[0].id}`,
        severity: 'warning',
        title: 'Nombre duplicado',
        detail: `${group.length} elementos de tipo ${NODE_TYPE_LABELS[group[0].nodeType].toLowerCase()} se llaman “${group[0].label}”.`,
        nodeIds: group.map((node) => node.id),
        edgeIds: [],
      });
    }
  }

  if (design.nodes.length > 1) {
    const isolated = design.nodes.filter((node) => !degree.has(node.id));
    if (isolated.length > 0) {
      issues.push({
        id: 'isolated-nodes',
        severity: 'warning',
        title: 'Componentes aislados',
        detail: `${isolated.length} componente(s) sin conexiones: ${isolated
          .slice(0, 4)
          .map((node) => `“${node.label}”`)
          .join(', ')}${isolated.length > 4 ? '…' : ''}.`,
        nodeIds: isolated.map((node) => node.id),
        edgeIds: [],
      });
    }
  }

  const unnamed = design.nodes.filter(
    (node) => node.origin === 'proposed' && isDefaultNodeLabel(node.label)
  );
  if (unnamed.length > 0) {
    issues.push({
      id: 'default-labels',
      severity: 'info',
      title: 'Componentes sin nombre',
      detail: `${unnamed.length} componente(s) propuesto(s) conservan el nombre por defecto.`,
      nodeIds: unnamed.map((node) => node.id),
      edgeIds: [],
    });
  }

  const missingResponsibility = design.nodes.filter(
    (node) =>
      node.origin === 'proposed' &&
      node.nodeType === 'module' &&
      !(typeof node.properties.responsibility === 'string' && node.properties.responsibility.trim())
  );
  if (missingResponsibility.length > 0) {
    issues.push({
      id: 'missing-responsibility',
      severity: 'info',
      title: 'Módulos sin responsabilidad',
      detail: `${missingResponsibility.length} módulo(s) propuesto(s) no documentan su responsabilidad.`,
      nodeIds: missingResponsibility.map((node) => node.id),
      edgeIds: [],
    });
  }

  const severityOrder: Record<DesignIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ── Exportación ──

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const EXPORT_OPTIONS: readonly { format: ExportFormat; label: string }[] = [
  { format: 'structurizr-dsl', label: 'Structurizr DSL' },
  { format: 'plant-uml', label: 'PlantUML' },
  { format: 'mermaid', label: 'Mermaid' },
];

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

export function getExportFileName(designName: string, format: ExportFormat): string {
  return `${slugify(designName) || 'arquitectura-propuesta'}.${getExportExtension(format)}`;
}
