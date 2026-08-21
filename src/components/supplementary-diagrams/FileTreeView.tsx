import React, { memo, useCallback, useMemo, useState } from 'react';
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
import { FileCode, Folder, FolderOpen } from 'lucide-react';
import type { C4DiagramData } from '../../../shared/types';
import { useProjectStore } from '../../stores/useProjectStore';
import { getLayoutedElements } from '../../lib/dagre-layout';

// ── Types ──

interface TreeEntry {
  /** Full path key, e.g. "src/components/layout" */
  path: string;
  /** Display name (basename) */
  name: string;
  isDir: boolean;
  /** Children paths */
  children: string[];
  /** Language for files */
  language?: string;
  /** LOC for files */
  loc?: number;
  /** Maintainability index for files */
  maintainability?: number;
}

interface FileTreeNodeData extends Record<string, unknown> {
  entry: TreeEntry;
  isExpanded: boolean;
  isRoot: boolean;
}

// ── Colores por lenguaje ──

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3776ab',
  java: '#b07219',
  kotlin: '#A97BFF',
  csharp: '#68217a',
  swift: '#FA7343',
  go: '#00ADD8',
  rust: '#dea584',
};

// ── Custom Node: Esfera con nombre debajo ──

const FileTreeNode: React.FC<NodeProps> = ({ data, sourcePosition, targetPosition }) => {
  const { entry, isExpanded, isRoot } = data as FileTreeNodeData;
  const isDir = entry.isDir;

  // Color del círculo
  let circleColor = '#3b82f6'; // azul para carpetas
  if (!isDir) {
    circleColor = LANG_COLORS[entry.language || ''] || '#6b7280';
  }

  // Tamaño del círculo
  const size = isRoot ? 52 : isDir ? 42 : 34;

  // Health color ring for files
  let ringColor = 'transparent';
  if (!isDir && entry.maintainability !== undefined) {
    ringColor =
      entry.maintainability >= 80
        ? '#10b981'
        : entry.maintainability >= 60
          ? '#f59e0b'
          : '#f43f5e';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: isDir ? 'pointer' : 'default',
      }}
      title={
        isDir
          ? `📁 ${entry.path} (clic para ${isExpanded ? 'colapsar' : 'expandir'})`
          : `📄 ${entry.name} — ${entry.language || '?'} · ${entry.loc ?? 0} LOC · MI: ${entry.maintainability?.toFixed(1) ?? '—'}`
      }
    >
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        style={{ background: '#374151', width: 6, height: 6, border: 'none' }}
      />

      {/* Sphere */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${circleColor}cc, ${circleColor}88, ${circleColor}55)`,
          border: `2.5px solid ${isDir ? (isExpanded ? '#60a5fa' : '#3b82f6') : ringColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isExpanded
            ? `0 0 14px ${circleColor}66`
            : `0 2px 8px rgba(0,0,0,0.4)`,
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        {isDir ? (
          isExpanded ? (
            <FolderOpen style={{ width: size * 0.45, height: size * 0.45, color: '#fff' }} />
          ) : (
            <Folder style={{ width: size * 0.45, height: size * 0.45, color: '#fff' }} />
          )
        ) : (
          <FileCode style={{ width: size * 0.45, height: size * 0.45, color: '#fff' }} />
        )}
      </div>

      {/* Label below sphere */}
      <span
        style={{
          fontSize: isRoot ? 11 : 10,
          fontWeight: isRoot ? 700 : isDir ? 600 : 400,
          color: isDir ? 'var(--cyan)' : 'var(--text)',
          maxWidth: 110,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        {entry.name}
      </span>

      {/* File badges */}
      {!isDir && entry.language && (
        <span
          style={{
            fontSize: 8,
            padding: '1px 5px',
            borderRadius: 4,
            background: `${circleColor}33`,
            color: circleColor,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {entry.language}
        </span>
      )}

      <Handle
        type="source"
        position={sourcePosition || Position.Right}
        style={{ background: '#374151', width: 6, height: 6, border: 'none' }}
      />
    </div>
  );
};

const MemoizedFileTreeNode = memo(FileTreeNode);

const nodeTypes: NodeTypes = {
  fileTreeNode: MemoizedFileTreeNode,
};

// ── Helpers ──

/** Build a hierarchical tree map from flat module paths */
function buildTreeFromModules(
  modules: { id: string; name: string; language: string; loc: number; metrics: { maintainabilityIndex: number } }[]
): Map<string, TreeEntry> {
  const treeMap = new Map<string, TreeEntry>();

  // Ensure a directory entry exists and its ancestors
  const ensureDir = (dirPath: string) => {
    if (treeMap.has(dirPath)) return;
    const parts = dirPath.split('/');
    const name = parts[parts.length - 1] || dirPath;
    treeMap.set(dirPath, {
      path: dirPath,
      name,
      isDir: true,
      children: [],
    });
    // Ensure parent
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      ensureDir(parentPath);
      const parent = treeMap.get(parentPath)!;
      if (!parent.children.includes(dirPath)) {
        parent.children.push(dirPath);
      }
    }
  };

  for (const mod of modules) {
    const filePath = mod.id;
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1] || mod.name;

    // Ensure parent directories
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      ensureDir(dirPath);
      const parent = treeMap.get(dirPath)!;
      if (!parent.children.includes(filePath)) {
        parent.children.push(filePath);
      }
    }

    // Add file entry
    treeMap.set(filePath, {
      path: filePath,
      name: fileName,
      isDir: false,
      children: [],
      language: mod.language,
      loc: mod.loc,
      maintainability: mod.metrics.maintainabilityIndex,
    });
  }

  return treeMap;
}

/** Find root nodes (entries with no parent in the map) */
function findRoots(treeMap: Map<string, TreeEntry>): string[] {
  const allChildren = new Set<string>();
  for (const entry of treeMap.values()) {
    for (const child of entry.children) {
      allChildren.add(child);
    }
  }
  const roots: string[] = [];
  for (const [path, entry] of treeMap) {
    if (!allChildren.has(path) && entry.isDir) {
      roots.push(path);
    }
  }
  // If no directory roots, wrap everything under a synthetic root
  if (roots.length === 0) {
    return Array.from(treeMap.keys()).filter((k) => {
      const entry = treeMap.get(k)!;
      return entry.isDir;
    });
  }
  return roots;
}

// ── Main Component ──

interface FileTreeViewProps {
  diagramData: C4DiagramData;
}

export const FileTreeView: React.FC<FileTreeViewProps> = ({ diagramData: _diagramData }) => {
  const { amg } = useProjectStore();
  const modules = amg?.modules || [];

  // State: which directories are expanded
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());

  // Build tree structure
  const treeMap = useMemo(() => buildTreeFromModules(modules), [modules]);
  const roots = useMemo(() => findRoots(treeMap), [treeMap]);

  // Toggle expansion
  const toggleExpand = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Build visible nodes and edges based on expanded state
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const visibleNodes: Node<FileTreeNodeData>[] = [];
    const visibleEdges: Edge[] = [];

    // BFS from roots
    const queue: string[] = [...roots];
    const visited = new Set<string>();

    // If we have a single root, auto-expand it initially
    // (but don't mutate state here, just treat it as expanded for rendering)
    const effectiveExpanded = new Set(expandedDirs);
    if (roots.length === 1 && effectiveExpanded.size === 0) {
      effectiveExpanded.add(roots[0]);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const entry = treeMap.get(current);
      if (!entry) continue;

      const isExpanded = entry.isDir && effectiveExpanded.has(current);
      const isRoot = roots.includes(current);

      visibleNodes.push({
        id: current,
        type: 'fileTreeNode',
        position: { x: 0, y: 0 },
        data: {
          entry,
          isExpanded,
          isRoot,
        },
      });

      // If this directory is expanded, add its children
      if (isExpanded) {
        for (const childPath of entry.children) {
          const childEntry = treeMap.get(childPath);
          if (!childEntry) continue;

          visibleEdges.push({
            id: `edge-${current}-${childPath}`,
            source: current,
            target: childPath,
            style: {
              stroke: childEntry.isDir ? '#3b82f6' : '#4b5563',
              strokeWidth: 1.5,
              strokeDasharray: childEntry.isDir ? undefined : '4 3',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: childEntry.isDir ? '#3b82f6' : '#4b5563',
              width: 10,
              height: 10,
            },
          });

          queue.push(childPath);
        }
      }
    }

    if (visibleNodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    return getLayoutedElements(visibleNodes, visibleEdges, {
      direction: 'LR',
      nodeWidth: 130,
      nodeHeight: 80,
      nodesep: 30,
      ranksep: 70,
    });
  }, [treeMap, roots, expandedDirs]);

  // Handle node click → toggle folders
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FileTreeNodeData>) => {
      const entry = (node.data as FileTreeNodeData).entry;
      if (entry.isDir) {
        toggleExpand(entry.path);
      }
    },
    [toggleExpand]
  );

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
        <Folder style={{ width: 40, height: 40, opacity: 0.4 }} />
        <p>Sin datos de estructura de directorios</p>
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
          background: 'var(--diagram-toolbar-bg)',
          backdropFilter: 'blur(8px)',
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          Árbol de Directorios — Grafo Horizontal
        </span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          Clic en una carpeta para expandir/colapsar · {layoutedNodes.length} nodos visibles
        </span>
      </div>

      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={3}
        attributionPosition="bottom-right"
      >
        <Background color="var(--diagram-grid)" gap={20} />
        <Controls
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as FileTreeNodeData;
            return d.entry.isDir ? '#3b82f6' : (LANG_COLORS[d.entry.language || ''] || '#6b7280');
          }}
          maskColor="var(--diagram-minimap-mask)"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
};
