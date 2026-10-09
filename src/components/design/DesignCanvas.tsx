import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type OnNodeDrag,
  type OnSelectionChangeParams,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { NodePosition } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import DesignNode from './DesignNode';
import { DesignLegend, DesignSearch } from './DesignCanvasOverlays';
import { EdgeEditorDialog } from './EdgeEditorDialog';
import {
  DESIGN_NODE_MIME,
  DESIGN_TEMPLATE_MIME,
  getDefaultNodeLabel,
  layoutDesignElements,
  parseNodeDragPayload,
  toFlowEdges,
  toFlowNodes,
  validateNewConnection,
  type DesignFlowEdge,
  type DesignFlowNode,
} from './design-flow';
import { DESIGN_TEMPLATES } from './design-templates';
import { useDesignPlacement } from './useDesignPlacement';

const NODE_TYPES: NodeTypes = { design: DesignNode };
const EDGE_TYPES: EdgeTypes = {};

interface PendingConnection {
  source: string;
  target: string;
}

function isDefaultLayout(layout: { viewport: NodePosition; zoom: number } | undefined): boolean {
  return !layout || (layout.viewport.x === 0 && layout.viewport.y === 0 && layout.zoom === 1);
}

export interface DesignCanvasProps {
  autoLayoutRequest?: number;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({ autoLayoutRequest = 0 }) => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const selectedNodeIds = useDesignStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDesignStore((state) => state.selectedEdgeIds);
  const focusRequest = useDesignStore((state) => state.focusRequest);
  const setSelection = useDesignStore((state) => state.setSelection);
  const clearSelection = useDesignStore((state) => state.clearSelection);
  const addNode = useDesignStore((state) => state.addNode);
  const moveNodes = useDesignStore((state) => state.moveNodes);
  const removeElements = useDesignStore((state) => state.removeElements);
  const addEdge = useDesignStore((state) => state.addEdge);
  const updateEdge = useDesignStore((state) => state.updateEdge);
  const setEditingNode = useDesignStore((state) => state.setEditingNode);
  const updateCanvasLayout = useDesignStore((state) => state.updateCanvasLayout);

  const [nodes, setNodes, onNodesChange] = useNodesState<DesignFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignFlowEdge>([]);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { placeFragment } = useDesignPlacement();

  const highlightedNodeIds = useMemo(() => {
    if (!currentDesign || selectedNodeIds.length === 0) return null;
    const highlighted = new Set(selectedNodeIds);
    for (const edge of currentDesign.edges) {
      if (selectedNodeIds.includes(edge.source)) highlighted.add(edge.target);
      if (selectedNodeIds.includes(edge.target)) highlighted.add(edge.source);
    }
    return highlighted;
  }, [currentDesign, selectedNodeIds]);

  useEffect(() => {
    if (!currentDesign) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(toFlowNodes(currentDesign.nodes, selectedNodeIds, highlightedNodeIds));
    setEdges(toFlowEdges(currentDesign.edges, selectedNodeIds, selectedEdgeIds));
  }, [currentDesign, highlightedNodeIds, selectedNodeIds, selectedEdgeIds, setEdges, setNodes]);

  useEffect(() => {
    if (autoLayoutRequest <= 0 || nodes.length === 0) return;

    const layouted = layoutDesignElements(nodes, edges);
    moveNodes(
      Object.fromEntries(layouted.nodes.map((node) => [node.id, { ...node.position }]))
    );

    window.setTimeout(() => {
      void fitView({ padding: 0.2, duration: 250 });
    }, 0);
    // The request counter intentionally controls when layout is recalculated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLayoutRequest]);

  useEffect(() => {
    if (!focusRequest) return;
    const timeout = window.setTimeout(() => {
      const edgeNodeIds = (useDesignStore.getState().currentDesign?.edges ?? [])
        .filter((edge) => focusRequest.edgeIds.includes(edge.id))
        .flatMap((edge) => [edge.source, edge.target]);
      const ids = [...new Set([...focusRequest.nodeIds, ...edgeNodeIds])];
      if (ids.length === 0) return;
      void fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.35,
        duration: 350,
        maxZoom: 1.25,
      });
    }, 30);
    return () => window.clearTimeout(timeout);
  }, [fitView, focusRequest]);

  useEffect(() => {
    if (!reconnectError) return;
    const timeout = window.setTimeout(() => setReconnectError(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [reconnectError]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      const nextNodeIds = selectedNodes.map((node) => node.id);
      const nextEdgeIds = selectedEdges.map((edge) => edge.id);
      const current = useDesignStore.getState();
      if (
        nextNodeIds.join('\u0000') === current.selectedNodeIds.join('\u0000') &&
        nextEdgeIds.join('\u0000') === current.selectedEdgeIds.join('\u0000')
      ) {
        return;
      }
      setSelection(nextNodeIds, nextEdgeIds);
    },
    [setSelection]
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<DesignFlowNode>>(
    (_event, _node, draggedNodes) => {
      moveNodes(
        Object.fromEntries(draggedNodes.map((node) => [node.id, { ...node.position }]))
      );
    },
    [moveNodes]
  );

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setPendingConnection({ source: connection.source, target: connection.target });
  }, []);

  const handleReconnect = useCallback(
    (oldEdge: DesignFlowEdge, connection: Connection) => {
      const design = useDesignStore.getState().currentDesign;
      const stored = design?.edges.find((edge) => edge.id === oldEdge.id);
      if (!design || !stored || !connection.source || !connection.target) return;
      if (connection.source === stored.source && connection.target === stored.target) return;

      const error = validateNewConnection(
        design,
        connection.source,
        connection.target,
        stored.edgeType,
        stored.id
      );
      if (error) {
        setReconnectError(error);
        return;
      }
      updateEdge(stored.id, { source: connection.source, target: connection.target });
    },
    [updateEdge]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const templateId = event.dataTransfer.getData(DESIGN_TEMPLATE_MIME);
      if (templateId) {
        const template = DESIGN_TEMPLATES.find((item) => item.id === templateId);
        if (template) placeFragment(template.fragment, position);
        return;
      }

      const payload = parseNodeDragPayload(event.dataTransfer.getData(DESIGN_NODE_MIME));
      if (!payload) return;

      const node = addNode(
        payload.nodeType,
        getDefaultNodeLabel(payload.nodeType),
        { x: position.x - 112, y: position.y - 40 }
      );
      if (node) {
        setSelection([node.id], []);
        setEditingNode(node.id);
      }
    },
    [addNode, placeFragment, screenToFlowPosition, setEditingNode, setSelection]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      const layout = useDesignStore.getState().currentDesign?.canvasLayout;
      if (
        !layout ||
        layout.viewport.x !== viewport.x ||
        layout.viewport.y !== viewport.y ||
        layout.zoom !== viewport.zoom
      ) {
        updateCanvasLayout({
          viewport: { x: viewport.x, y: viewport.y },
          zoom: viewport.zoom,
        });
      }
    },
    [updateCanvasLayout]
  );

  const pendingLabels = useMemo(() => {
    if (!pendingConnection || !currentDesign) return { source: '', target: '' };
    return {
      source:
        currentDesign.nodes.find((node) => node.id === pendingConnection.source)?.label ??
        pendingConnection.source,
      target:
        currentDesign.nodes.find((node) => node.id === pendingConnection.target)?.label ??
        pendingConnection.target,
    };
  }, [currentDesign, pendingConnection]);

  const pendingSuggestedType = useMemo(() => {
    if (!pendingConnection || !currentDesign) return 'dependency' as const;
    const source = currentDesign.nodes.find((node) => node.id === pendingConnection.source);
    const target = currentDesign.nodes.find((node) => node.id === pendingConnection.target);
    if (target?.nodeType === 'external-system') return 'external-call' as const;
    if (source?.nodeType === 'actor') return 'invocation' as const;
    if (source?.nodeType === 'container' && target?.nodeType === 'module') {
      return 'containment' as const;
    }
    if (source?.nodeType === 'container' && target?.nodeType === 'container') {
      return 'invocation' as const;
    }
    return 'dependency' as const;
  }, [currentDesign, pendingConnection]);

  if (!currentDesign) return null;

  const layout = currentDesign.canvasLayout;

  return (
    <section className="design-canvas" aria-label={`Canvas de ${currentDesign.name}`}>
      <div className="design-canvas__flow" onDrop={handleDrop} onDragOver={handleDragOver}>
        <ReactFlow<DesignFlowNode, DesignFlowEdge>
          key={currentDesign.id}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onBeforeDelete={async ({ nodes: deletedNodes, edges: deletedEdges }) => {
            removeElements(
              deletedNodes.map((node) => node.id),
              deletedEdges.map((edge) => edge.id)
            );
            return false;
          }}
          onNodeDragStop={handleNodeDragStop}
          onNodeDoubleClick={(_event, node) => setEditingNode(node.id)}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          onSelectionChange={handleSelectionChange}
          onPaneClick={clearSelection}
          onMoveEnd={handleMoveEnd}
          fitView={isDefaultLayout(layout) && currentDesign.nodes.length > 0}
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
          defaultViewport={{
            x: Number.isFinite(layout?.viewport?.x) ? layout.viewport.x : 0,
            y: Number.isFinite(layout?.viewport?.y) ? layout.viewport.y : 0,
            zoom: Number.isFinite(layout?.zoom) && layout.zoom > 0 ? layout.zoom : 1,
          }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          edgesReconnectable
          zoomOnDoubleClick={false}
          deleteKeyCode={['Backspace', 'Delete']}
          minZoom={0.1}
          maxZoom={2.5}
          attributionPosition="bottom-right"
        >
          <Background color="var(--design-grid-color, var(--diagram-grid))" gap={20} />
          <Controls className="design-flow-controls" />
          <MiniMap
            className="design-flow-minimap"
            pannable
            zoomable
            nodeColor="var(--design-minimap-node, var(--accent-blue))"
            maskColor="var(--design-minimap-mask, var(--diagram-minimap-mask))"
          />
          <Panel position="top-left">
            <DesignSearch />
          </Panel>
          <Panel position="bottom-center">
            <DesignLegend />
          </Panel>
          {reconnectError && (
            <Panel position="top-center">
              <p className="design-canvas__toast" role="alert">{reconnectError}</p>
            </Panel>
          )}
          {currentDesign.nodes.length === 0 && (
            <Panel position="top-center" className="design-canvas__empty-hint">
              <p>Lienzo vacío: arrastra componentes o una plantilla desde la barra lateral.</p>
            </Panel>
          )}
        </ReactFlow>
      </div>

      <EdgeEditorDialog
        open={pendingConnection !== null}
        sourceLabel={pendingLabels.source}
        targetLabel={pendingLabels.target}
        suggestedType={pendingSuggestedType}
        onCancel={() => setPendingConnection(null)}
        onSubmit={(edgeType, label) => {
          if (!pendingConnection) return null;
          const design = useDesignStore.getState().currentDesign;
          if (!design) return 'No hay un diseño abierto.';

          const error = validateNewConnection(
            design,
            pendingConnection.source,
            pendingConnection.target,
            edgeType
          );
          if (error) return error;

          const edge = addEdge(
            pendingConnection.source,
            pendingConnection.target,
            edgeType,
            label
          );
          if (!edge) return 'No se pudo crear la conexión.';

          setSelection([], [edge.id]);
          setPendingConnection(null);
          return null;
        }}
      />
    </section>
  );
};
