import React, { useCallback, useMemo } from 'react';
import { AlertCircle, Layers, LoaderCircle, Sparkles } from 'lucide-react';
import type { C4DiagramData, C4Node } from '../../../shared/types';
import { getModuleCodeDiagram } from '../../lib/tauri-api';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { MainTab, SupplementaryDiagramTab } from '../../stores/useUiStore';
import {
  CallGraphView,
  CircularDependenciesView,
  CouplingHeatmapView,
  DfdDiagramView,
  DynamicDiagramView,
  ErDiagramView,
  FileTreeView,
  ForceGraphView,
  InheritanceTreeView,
  OwnershipMapView,
  PackageDiagramView,
  SequenceDiagramView,
  SupplementaryDiagramView,
  TimelineView,
  TreemapView,
} from '../supplementary-diagrams';
import { C4Canvas } from './C4Canvas';
import {
  getSupplementaryDiagramDefinition,
  isSupplementaryDiagramTab,
} from './diagram-registry';

interface C4ViewerProps {
  activeTab: MainTab;
}

const supplementaryViews: Record<
  SupplementaryDiagramTab,
  React.ComponentType<{ diagramData: C4DiagramData; tab?: SupplementaryDiagramTab }>
> = {
  circular: CircularDependenciesView,
  package: PackageDiagramView,
  inheritance: InheritanceTreeView,
  er: ErDiagramView,
  callgraph: CallGraphView,
  sequence: SequenceDiagramView,
  dynamic: DynamicDiagramView,
  dfd: DfdDiagramView,
  'coupling-heatmap': CouplingHeatmapView,
  deployment: (props) => <SupplementaryDiagramView tab="deployment" {...props} />,
  filetree: FileTreeView,
  treemap: TreemapView,
  ownership: OwnershipMapView,
  landscape: (props) => <SupplementaryDiagramView tab="landscape" {...props} />,
  timeline: TimelineView,
  'force-graph': ForceGraphView,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const C4Viewer: React.FC<C4ViewerProps> = ({ activeTab }) => {
  const { amg } = useProjectStore();
  const { selectElement } = useSelectionStore();
  const {
    c4Level,
    activeContainerId,
    codeDiagramData,
    setC4Level,
    setCodeDiagramData,
    isLoadingCodeDiagram,
    setCodeDiagramLoading,
    codeDiagramError,
    setCodeDiagramError,
  } = useDiagramStore();

  const componentDiagramKeys = useMemo(
    () =>
      amg
        ? Object.keys(amg.c4Models.componentDiagrams).filter(
            (key) => !key.startsWith('supplementary:')
          )
        : [],
    [amg]
  );

  const resolvedContainerId = useMemo(() => {
    if (!amg) return null;
    if (activeContainerId && amg.c4Models.componentDiagrams[activeContainerId]) {
      return activeContainerId;
    }
    return (
      amg.containers.find((container) => componentDiagramKeys.includes(container.id))?.id ||
      componentDiagramKeys[0] ||
      null
    );
  }, [activeContainerId, amg, componentDiagramKeys]);

  const handleNodeClick = useCallback(
    (node: C4Node) => selectElement(node.amgNodeId || node.id, 'c4_node', node),
    [selectElement]
  );

  const isNodeDrillable = useCallback(
    (node: C4Node) => {
      if (activeTab !== 'c4') return false;
      if (c4Level === 1) return node.elementType === 'Software System';
      if (c4Level === 2) return node.elementType.startsWith('Container');
      if (c4Level === 3) return Boolean(node.amgNodeId);
      return false;
    },
    [activeTab, c4Level]
  );

  const handleNodeDoubleClick = useCallback(
    async (node: C4Node) => {
      if (!amg) return;

      if (c4Level === 1) {
        setC4Level(2);
        return;
      }

      if (c4Level === 2) {
        const container = amg.containers.find(
          (item) => item.id === node.id || item.id === node.amgNodeId
        );
        if (container) setC4Level(3, container.id, null, `Componentes: ${container.name}`);
        return;
      }

      if (c4Level !== 3 || !node.amgNodeId) return;

      setCodeDiagramLoading(true);
      setCodeDiagramError(null);
      try {
        const codeData = await getModuleCodeDiagram(node.amgNodeId, amg);
        setCodeDiagramData(codeData);
        setC4Level(4, resolvedContainerId, node.amgNodeId, `Código: ${node.label}`);
      } catch (error) {
        setCodeDiagramError(`No se pudo generar el diagrama de código: ${getErrorMessage(error)}`);
      } finally {
        setCodeDiagramLoading(false);
      }
    }, [
      amg,
      c4Level,
      resolvedContainerId,
      setC4Level,
      setCodeDiagramData,
      setCodeDiagramError,
      setCodeDiagramLoading,
    ]
  );

  if (!amg) {
    return (
      <div className="diagram-empty-state">
        <Layers aria-hidden="true" />
        <p>Sin datos de diagrama</p>
        <span>Analice un proyecto para explorar sus vistas arquitectónicas.</span>
      </div>
    );
  }

  let diagramData: C4DiagramData | null = null;
  let title = '';

  if (activeTab === 'c4') {
    if (c4Level === 1) {
      diagramData = amg.c4Models.contextDiagram;
      title = 'C4 Nivel 1 — Contexto';
    } else if (c4Level === 2) {
      diagramData = amg.c4Models.containerDiagram;
      title = 'C4 Nivel 2 — Contenedores';
    } else if (c4Level === 3) {
      diagramData = resolvedContainerId
        ? amg.c4Models.componentDiagrams[resolvedContainerId] || null
        : null;
      const containerName = amg.containers.find(
        (container) => container.id === resolvedContainerId
      )?.name;
      title = `C4 Nivel 3 — Componentes${containerName ? ` de ${containerName}` : ''}`;
    } else {
      diagramData = codeDiagramData;
      title = 'C4 Nivel 4 — Código';
    }
  } else if (isSupplementaryDiagramTab(activeTab)) {
    const definition = getSupplementaryDiagramDefinition(activeTab);
    diagramData = amg.c4Models.componentDiagrams[definition.backendKey] || null;
    title = definition.title;
  }

  if (!diagramData || (diagramData.nodes.length === 0 && diagramData.edges.length === 0)) {
    return (
      <div className="diagram-empty-state">
        <Sparkles aria-hidden="true" />
        <p>Diagrama sin datos</p>
        <span>
          El análisis no encontró estructuras para {title || 'esta vista'}.
        </span>
      </div>
    );
  }

  const SupplementaryView = isSupplementaryDiagramTab(activeTab)
    ? supplementaryViews[activeTab]
    : null;

  return (
    <div className="diagram-viewer">
      {SupplementaryView ? (
        <SupplementaryView diagramData={diagramData} />
      ) : (
        <C4Canvas
          diagramData={diagramData}
          title={title}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          isNodeDrillable={isNodeDrillable}
        />
      )}

      {isLoadingCodeDiagram && (
        <div className="diagram-status-overlay" role="status" aria-live="polite">
          <LoaderCircle className="diagram-status-overlay__spinner" aria-hidden="true" />
          <span>Generando diagrama de código…</span>
        </div>
      )}

      {codeDiagramError && activeTab === 'c4' && (
        <div className="diagram-error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{codeDiagramError}</span>
          <button type="button" onClick={() => setCodeDiagramError(null)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};
