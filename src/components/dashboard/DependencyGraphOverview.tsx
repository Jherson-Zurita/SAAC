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
        mi >= 80 ? '#10b981' : mi >= 60 ? '#f59e0b' : '#f43f5e';

      return {
        id: mod.id,
        position: { x: 0, y: 0 },
        data: { label: mod.name, module: mod },
        type: 'default',
        style: {
          background: '#161a26',
          color: '#f3f4f6',
          border: `1.5px solid ${borderColor}`,
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        },
      };
    });

    const rawEdges: Edge[] = amg.dependencies.map((dep, idx) => ({
      id: `dep-${idx}`,
      source: dep.source,
      target: dep.target,
      animated: dep.kind === 'http-call' || dep.kind === 'messaging',
      style: { stroke: '#3b82f6', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#3b82f6',
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
    <div className="h-[450px] w-full bg-[#0d0f17] border border-[#1e2333] rounded-xl overflow-hidden relative shadow-lg">
      <div className="absolute top-3 left-3 z-10 bg-[#121520]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1e2333] text-xs font-semibold text-gray-200">
        Grafo de Dependencias Generales ({amg.modules.length} módulos, {amg.dependencies.length} aristas)
      </div>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#1e2333" gap={16} />
        <Controls className="bg-[#121520] border border-[#1e2333] fill-gray-300 text-gray-300 rounded-lg overflow-hidden" />
        <MiniMap
          nodeColor={(n) => (n.style?.border as string)?.split(' ')[2] || '#3b82f6'}
          maskColor="rgba(9, 11, 16, 0.8)"
          className="bg-[#121520] border border-[#1e2333] rounded-lg"
        />
      </ReactFlow>
    </div>
  );
};
