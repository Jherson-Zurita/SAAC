import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLayoutedElements } from '../../lib/dagre-layout';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { ArchitectureModelGraph, Module } from '../../../shared/types';

interface DependencyGraphOverviewProps {
  amg: ArchitectureModelGraph;
}

export const DependencyGraphOverview: React.FC<DependencyGraphOverviewProps> = ({ amg }) => {
  const { selectElement } = useSelectionStore();

  // Construir Nodos y Edges de ReactFlow a partir de amg.modules y amg.dependencies
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const rawNodes: Node[] = amg.modules.map((mod) => {
      const mi = mod.metrics.maintainabilityIndex;
      const borderColor =
        mi >= 80 ? 'var(--green)' : mi >= 60 ? 'var(--yellow)' : 'var(--red)';

      return {
        id: mod.id,
        position: { x: 0, y: 0 },
        data: { label: mod.name, module: mod },
        type: 'default',
        style: {
          background: 'var(--panel-2)',
          color: 'var(--text)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
      };
    });

    const rawEdges: Edge[] = amg.dependencies.map((dep, idx) => ({
      id: `dep-${idx}`,
      source: dep.source,
      target: dep.target,
      animated: dep.kind === 'http-call' || dep.kind === 'messaging',
      style: { stroke: 'var(--cyan)', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--cyan)',
        width: 15,
        height: 15,
      },
    }));

    return getLayoutedElements(rawNodes, rawEdges, { direction: 'LR', nodeWidth: 180, nodeHeight: 50 });
  }, [amg]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.data?.module) {
      selectElement(node.id, 'module', node.data.module as Module);
    }
  };

  return (
    <div className="h-[450px] w-full bg-[var(--diagram-canvas)] border border-[var(--border)] rounded-xl overflow-hidden relative shadow-lg">
      <div className="absolute top-3 left-3 z-10 bg-[var(--diagram-toolbar-bg)] backdrop-blur-md px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text)]">
        Grafo de Dependencias Generales ({amg.modules.length} módulos, {amg.dependencies.length} aristas)
      </div>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="var(--diagram-grid)" gap={16} />
        <Controls className="bg-[var(--panel)] border border-[var(--border)] fill-[var(--text)] text-[var(--text)] rounded-lg overflow-hidden" />
        <MiniMap
          nodeColor={(n) => (n.style?.border as string)?.split(' ')[2] || 'var(--cyan)'}
          maskColor="var(--diagram-minimap-mask)"
          className="bg-[var(--panel)] border border-[var(--border)] rounded-lg"
        />
      </ReactFlow>
    </div>
  );
};
