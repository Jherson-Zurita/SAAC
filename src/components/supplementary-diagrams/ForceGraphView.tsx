import React, { memo, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';
import { getLayoutedElements } from '../../lib/dagre-layout';
import { NodeContextMenu } from '../c4viewer/NodeContextMenu';

// ── Types ──

interface ForceNodeData extends Record<string, unknown> {
  label: string;
  language: string;
  moduleType: string;
  connections: number;
  loc: number;
  maintainability: number;
  radius: number;
}

// ── Color palette by health ──

function getHealthColor(mi: number): string {
  if (mi >= 80) return '#10b981'; // green
  if (mi >= 60) return '#f59e0b'; // amber
  return '#f43f5e'; // red
}

function getHealthGradient(mi: number): string {
  const c = getHealthColor(mi);
  return `radial-gradient(circle at 35% 35%, ${c}dd, ${c}88, ${c}44)`;
}

// ── Custom circular node ──

const ForceNode: React.FC<NodeProps> = ({ data, sourcePosition, targetPosition }) => {
  const { label, connections, maintainability, radius, language, loc } = data as ForceNodeData;

  const color = getHealthColor(maintainability);
  const diameter = radius * 2;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
      title={`${label}\n${language} · ${loc} LOC · ${connections} conexiones\nMI: ${maintainability.toFixed(1)}`}
    >
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        style={{ background: '#374151', width: 5, height: 5, border: 'none' }}
      />

      {/* Circular sphere */}
      <div
        style={{
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          background: getHealthGradient(maintainability),
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 ${Math.min(connections * 2, 20)}px ${color}44, 0 4px 12px rgba(0,0,0,0.3)`,
          transition: 'box-shadow 0.3s',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: Math.max(8, Math.min(11, radius * 0.4)),
            fontWeight: 700,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.1,
            padding: 3,
            maxWidth: diameter - 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        >
          {label}
        </span>
      </div>

      {/* Connection count badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#94a3b8',
          background: '#1e293b',
          padding: '1px 6px',
          borderRadius: 6,
          border: '1px solid #334155',
        }}
      >
        {connections} dep
      </span>

      <Handle
        type="source"
        position={sourcePosition || Position.Right}
        style={{ background: '#374151', width: 5, height: 5, border: 'none' }}
      />
    </div>
  );
};

const MemoizedForceNode = memo(ForceNode);

const nodeTypes: NodeTypes = {
  forceNode: MemoizedForceNode,
};

// ── Main Component ──

interface ForceGraphViewProps {
  diagramData: C4DiagramData;
}

export const ForceGraphView: React.FC<ForceGraphViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];
  const dependencies = amg?.dependencies || [];

  const [contextNode, setContextNode] = React.useState<{
    node: { id: string; label: string; elementType: string; technology: string; description: string; amgNodeId?: string };
    pos: { x: number; y: number };
  } | null>(null);

  const handleNodeClick = (event: React.MouseEvent, node: Node<ForceNodeData>) => {
    const c4Node = {
      id: node.id,
      label: node.data.label,
      elementType: 'Module',
      technology: `${node.data.language} (${node.data.connections} conexiones)`,
      description: `LOC: ${node.data.loc}, Maintainability Index: ${node.data.maintainability.toFixed(1)}`,
      amgNodeId: node.id,
    };
    setContextNode({
      node: c4Node,
      pos: { x: event.clientX, y: event.clientY },
    });
  };

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (modules.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Count connections per module (Ca + Ce = inbound + outbound)
    const connectionCount = new Map<string, number>();
    for (const mod of modules) {
      connectionCount.set(mod.id, 0);
    }
    for (const dep of dependencies) {
      connectionCount.set(dep.source, (connectionCount.get(dep.source) || 0) + 1);
      connectionCount.set(dep.target, (connectionCount.get(dep.target) || 0) + 1);
    }

    // Compute radius range: min 22, max 60
    const counts = Array.from(connectionCount.values());
    const maxConn = Math.max(...counts, 1);
    const minConn = Math.min(...counts, 0);
    const range = maxConn - minConn || 1;

    const MIN_RADIUS = 22;
    const MAX_RADIUS = 60;

    const rawNodes: Node<ForceNodeData>[] = modules.map((mod) => {
      const conn = connectionCount.get(mod.id) || 0;
      const normalised = (conn - minConn) / range;
      const radius = MIN_RADIUS + normalised * (MAX_RADIUS - MIN_RADIUS);

      return {
        id: mod.id,
        type: 'forceNode',
        position: { x: 0, y: 0 },
        width: radius * 2 + 20,
        height: radius * 2 + 30,
        data: {
          label: mod.name,
          language: mod.language,
          moduleType: mod.moduleType,
          connections: conn,
          loc: mod.loc,
          maintainability: mod.metrics.maintainabilityIndex,
          radius,
        },
      };
    });

    const rawEdges: Edge[] = dependencies.map((dep, idx) => ({
      id: `force-edge-${idx}-${dep.source}-${dep.target}`,
      source: dep.source,
      target: dep.target,
      animated: dep.kind === 'http-call' || dep.kind === 'messaging',
      style: {
        stroke: '#475569',
        strokeWidth: Math.min(1 + dep.weight * 0.5, 3),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#64748b',
        width: 12,
        height: 12,
      },
    }));

    return getLayoutedElements(rawNodes, rawEdges, {
      direction: 'LR',
      nodeWidth: 120,
      nodeHeight: 100,
      nodesep: 35,
      ranksep: 80,
    });
  }, [modules, dependencies]);

  if (modules.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
          gap: 8,
        }}
      >
        <p>Sin datos de módulos para el grafo de fuerza</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Header overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
          Grafo de Dependencias — Nodos Proporcionales
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          Tamaño ∝ N° de conexiones · Color = Índice de Mantenibilidad · {modules.length} módulos · {dependencies.length} aristas · Clic en un nodo para inspección
        </span>
      </div>

      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1' }}>Leyenda</span>
        {[
          { color: '#10b981', label: 'MI ≥ 80 (Saludable)' },
          { color: '#f59e0b', label: 'MI 60–79 (Alerta)' },
          { color: '#f43f5e', label: 'MI < 60 (Crítico)' },
        ].map(({ color, label }) => (
          <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                border: `1.5px solid ${color}`,
              }}
            />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #334155', paddingTop: 4, marginTop: 2 }}>
          <span style={{ fontSize: 9, color: '#64748b' }}>
            ⬤ grande = muchas conexiones
          </span>
        </div>
      </div>

      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={3}
        attributionPosition="bottom-right"
      >
        <Background color="#1e293b" gap={20} />
        <Controls
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as ForceNodeData;
            return getHealthColor(d.maintainability);
          }}
          maskColor="rgba(9, 11, 16, 0.8)"
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {contextNode && (
        <NodeContextMenu
          node={contextNode.node}
          position={contextNode.pos}
          onClose={() => setContextNode(null)}
        />
      )}
    </div>
  );
};
