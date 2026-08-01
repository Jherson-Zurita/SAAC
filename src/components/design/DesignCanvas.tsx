import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type OnSelectionChangeParams,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDesignStore } from '../../stores/useDesignStore';
import DesignNode from './DesignNode';
import { EdgeEditorDialog } from './EdgeEditorDialog';
import {
  DESIGN_NODE_MIME,
  getDefaultNodeLabel,
  layoutDesignElements,
  parseNodeDragPayload,
  toFlowEdges,
  toFlowNodes,
  validateNewConnection,
  type DesignFlowEdge,
  type DesignFlowNode,
} from './design-flow';

const NODE_TYPES: NodeTypes = { design: DesignNode };
const EDGE_TYPES: EdgeTypes = {};

interface PendingConnection {
  source: string;
  target: string;
}

export interface DesignCanvasProps {
  autoLayoutRequest?: number;
}

const DesignCanvasInner: React.FC<DesignCanvasProps> = ({ autoLayoutRequest = 0 }) => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const selectedNodeIds = useDesignStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDesignStore((state) => state.selectedEdgeIds);
  const setSelection = useDesignStore((state) => state.setSelection);
  const clearSelection = useDesignStore((state) => state.clearSelection);
  const addNode = useDesignStore((state) => state.addNode);
  const updateNode = useDesignStore((state) => state.updateNode);
  const removeNodes = useDesignStore((state) => state.removeNodes);
  const addEdge = useDesignStore((state) => state.addEdge);
  const removeEdges = useDesignStore((state) => state.removeEdges);
  const updateCanvasLayout = useDesignStore((state) => state.updateCanvasLayout);

  const [nodes, setNodes, onNodesChange] = useNodesState<DesignFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignFlowEdge>([]);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    if (!currentDesign) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(toFlowNodes(currentDesign.nodes, selectedNodeIds));
    setEdges(toFlowEdges(currentDesign.edges, selectedEdgeIds));
  }, [currentDesign, selectedNodeIds, selectedEdgeIds, setEdges, setNodes]);

  useEffect(() => {
    if (autoLayoutRequest <= 0 || nodes.length === 0) return;

    const layouted = layoutDesignElements(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    const design = useDesignStore.getState().currentDesign;
    if (design) {
      for (const layoutedNode of layouted.nodes) {
        const storedNode = design.nodes.find((node) => node.id === layoutedNode.id);
        if (
          storedNode &&
          (storedNode.position.x !== layoutedNode.position.x ||
            storedNode.position.y !== layoutedNode.position.y)
        ) {
          updateNode(layoutedNode.id, { position: { ...layoutedNode.position } });
        }
      }
    }

    window.setTimeout(() => {
      void fitView({ padding: 0.2, duration: 250 });
    }, 0);
    // The request counter intentionally controls when layout is recalculated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLayoutRequest]);

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

  const handleNodeDragStop = useCallback(() => {
    const design = useDesignStore.getState().currentDesign;
    if (!design) return;

    for (const flowNode of nodes) {
      const storedNode = design.nodes.find((node) => node.id === flowNode.id);
      if (
        storedNode &&
        (storedNode.position.x !== flowNode.position.x ||
          storedNode.position.y !== flowNode.position.y)
      ) {
        updateNode(flowNode.id, { position: { ...flowNode.position } });
      }
    }
  }, [nodes, updateNode]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setPendingConnection({ source: connection.source, target: connection.target });
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const payload = parseNodeDragPayload(event.dataTransfer.getData(DESIGN_NODE_MIME));
      if (!payload) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const node = addNode(
        payload.nodeType,
        getDefaultNodeLabel(payload.nodeType),
        position
      );
      if (node) setSelection([node.id], []);
    },
    [addNode, screenToFlowPosition, setSelection]
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

  if (!currentDesign) return null;

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
          onNodesDelete={(deletedNodes) => removeNodes(deletedNodes.map((node) => node.id))}
          onEdgesDelete={(deletedEdges) => removeEdges(deletedEdges.map((edge) => edge.id))}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onSelectionChange={handleSelectionChange}
          onPaneClick={clearSelection}
          onMoveEnd={handleMoveEnd}
          defaultViewport={{
            x: Number.isFinite(currentDesign.canvasLayout?.viewport?.x) ? currentDesign.canvasLayout.viewport.x : 0,
            y: Number.isFinite(currentDesign.canvasLayout?.viewport?.y) ? currentDesign.canvasLayout.viewport.y : 0,
            zoom: Number.isFinite(currentDesign.canvasLayout?.zoom) && currentDesign.canvasLayout.zoom > 0 ? currentDesign.canvasLayout.zoom : 1,
          }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          deleteKeyCode={['Backspace', 'Delete']}
          minZoom={0.2}
          maxZoom={2.5}
          attributionPosition="bottom-right"
        >
          <Background color="var(--design-grid-color, var(--diagram-grid))" gap={20} />
          <Controls className="design-flow-controls" />
          <MiniMap
            className="design-flow-minimap"
            nodeColor="var(--design-minimap-node, var(--accent-blue))"
            maskColor="var(--design-minimap-mask, var(--diagram-minimap-mask))"
          />
        </ReactFlow>
      </div>

      <EdgeEditorDialog
        open={pendingConnection !== null}
        sourceLabel={pendingLabels.source}
        targetLabel={pendingLabels.target}
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

export const DesignCanvas: React.FC<DesignCanvasProps> = (props) => (
  <ReactFlowProvider>
    <DesignCanvasInner {...props} />
  </ReactFlowProvider>
);
