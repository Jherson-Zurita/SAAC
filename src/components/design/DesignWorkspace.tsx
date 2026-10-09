import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { AnalysisRunSummary } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import { ComparisonPanel } from './ComparisonPanel';
import { DesignCanvas } from './DesignCanvas';
import { DesignInspector } from './DesignInspector';
import { DesignSidebar } from './DesignSidebar';
import { DesignToolbar } from './DesignToolbar';
import { ValidationPanel } from './ValidationPanel';
import { validateDesign } from './design-flow';

export interface DesignWorkspaceProps {
  projectPath: string;
  analysisRuns: AnalysisRunSummary[];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

const DesignWorkspaceInner: React.FC<DesignWorkspaceProps> = ({
  projectPath,
  analysisRuns,
}) => {
  const designs = useDesignStore((state) => state.designs);
  const hasLoadedList = useDesignStore((state) => state.hasLoadedList);
  const storeProjectPath = useDesignStore((state) => state.projectPath);
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const isLoading = useDesignStore((state) => state.isLoading);
  const isDirty = useDesignStore((state) => state.isDirty);
  const saveStatus = useDesignStore((state) => state.saveStatus);
  const error = useDesignStore((state) => state.error);
  const changeVersion = useDesignStore((state) => state.changeVersion);
  const save = useDesignStore((state) => state.save);
  const create = useDesignStore((state) => state.create);
  const open = useDesignStore((state) => state.open);
  const clearError = useDesignStore((state) => state.clearError);
  const comparisonReport = useDesignStore((state) => state.comparisonReport);
  const [autoLayoutRequest, setAutoLayoutRequest] = useState(0);
  const [validationOpen, setValidationOpen] = useState(false);
  const [autoOpenedProject, setAutoOpenedProject] = useState<string | null>(null);

  const currentAnalysisRunId = useMemo(
    () =>
      analysisRuns.length > 0
        ? analysisRuns[analysisRuns.length - 1].runId
        : null,
    [analysisRuns]
  );
  const compareRunId = currentDesign?.basedOnAnalysisRunId ?? currentAnalysisRunId;

  const designNodes = currentDesign?.nodes;
  const designEdges = currentDesign?.edges;
  const issues = useMemo(
    () => (currentDesign ? validateDesign(currentDesign) : []),
    // Viewport changes replace currentDesign without touching the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [designNodes, designEdges]
  );

  // Abre el diseño más reciente una sola vez por proyecto, cuando la lista ya cargó.
  useEffect(() => {
    if (!projectPath || storeProjectPath !== projectPath || !hasLoadedList) return;
    if (autoOpenedProject === projectPath) return;
    setAutoOpenedProject(projectPath);
    if (!currentDesign && designs.length > 0) {
      void open(projectPath, designs[0].id).catch(() => undefined);
    }
  }, [autoOpenedProject, currentDesign, designs, hasLoadedList, open, projectPath, storeProjectPath]);

  useEffect(() => {
    if (!currentDesign || !isDirty || saveStatus === 'saving') return;
    const designId = currentDesign.id;
    const timeout = window.setTimeout(() => {
      if (useDesignStore.getState().currentDesign?.id === designId) {
        void save(projectPath).catch(() => undefined);
      }
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [changeVersion, currentDesign, isDirty, projectPath, save, saveStatus]);

  useEffect(
    () => () => {
      const state = useDesignStore.getState();
      if (state.isDirty && state.projectPath === projectPath) {
        void state.save(projectPath).catch(() => undefined);
      }
    },
    [projectPath]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useDesignStore.getState();
      if (!state.currentDesign) return;
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (commandKey && key === 's') {
        event.preventDefault();
        void save(projectPath).catch(() => undefined);
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (!commandKey) {
        if (event.key === 'F2' && state.selectedNodeIds.length === 1) {
          event.preventDefault();
          state.setEditingNode(state.selectedNodeIds[0]);
        } else if (event.key === 'Escape') {
          state.clearSelection();
        }
        return;
      }

      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        state.redo();
      } else if (key === 'z') {
        event.preventDefault();
        state.undo();
      } else if (key === 'y') {
        event.preventDefault();
        state.redo();
      } else if (key === 'a') {
        event.preventDefault();
        state.selectAll();
      } else if (key === 'c') {
        if (state.copySelection()) event.preventDefault();
      } else if (key === 'v') {
        if (state.clipboard) {
          event.preventDefault();
          state.paste();
        }
      } else if (key === 'd') {
        event.preventDefault();
        state.duplicateSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectPath, save]);

  return (
    <section className="design-workspace" aria-label="Diseño arquitectónico">
      <DesignSidebar
        projectPath={projectPath}
        currentAnalysisRunId={currentAnalysisRunId}
      />

      <main className="design-workspace__main" aria-busy={isLoading}>
        {error && (
          <div className="design-workspace__error" role="alert">
            <span className="design-workspace__error-message">{error}</span>
            <button
              type="button"
              className="design-workspace__error-dismiss"
              onClick={clearError}
            >
              Cerrar
            </button>
          </div>
        )}

        {isLoading && !currentDesign && (
          <div className="design-workspace__state design-workspace__state--loading">
            <div className="design-workspace__spinner" aria-hidden="true" />
            <p className="design-workspace__state-title">Cargando lienzo de diseño…</p>
          </div>
        )}

        {!isLoading && !currentDesign && (
          <div className="design-workspace__state design-workspace__state--empty">
            <h1 className="design-workspace__state-title">Diseña la arquitectura futura</h1>
            <p className="design-workspace__state-description">
              Parte de la arquitectura real detectada por el análisis para evolucionarla, o empieza
              en blanco. También puedes elegir una plantilla (capas, hexagonal, microservicios o MVC)
              desde la barra lateral.
            </p>
            <div className="design-workspace__state-actions">
              <button
                type="button"
                className="design-workspace__state-button design-workspace__state-button--primary"
                onClick={() =>
                  void create(projectPath, 'Evolución del AMG actual', currentAnalysisRunId).catch(
                    () => undefined
                  )
                }
                disabled={!currentAnalysisRunId}
                title={currentAnalysisRunId ? undefined : 'Ejecuta un análisis primero'}
              >
                Clonar AMG actual
              </button>
              <button
                type="button"
                className="design-workspace__state-button"
                onClick={() =>
                  void create(projectPath, 'Nueva arquitectura', null).catch(() => undefined)
                }
              >
                Lienzo en blanco
              </button>
            </div>
          </div>
        )}

        {currentDesign && (
          <div className="design-workspace__editor">
            <DesignToolbar
              projectPath={projectPath}
              compareRunId={compareRunId}
              issues={issues}
              validationOpen={validationOpen}
              onToggleValidation={() => setValidationOpen((value) => !value)}
              onAutoLayout={() => setAutoLayoutRequest((request) => request + 1)}
            />

            {isLoading && (
              <div className="design-workspace__loading-indicator" role="status">
                Actualizando diseño…
              </div>
            )}

            <div className="design-workspace__content">
              <DesignCanvas autoLayoutRequest={autoLayoutRequest} />
              <DesignInspector />
            </div>

            {validationOpen && (
              <ValidationPanel issues={issues} onClose={() => setValidationOpen(false)} />
            )}
            {comparisonReport && <ComparisonPanel />}
          </div>
        )}
      </main>
    </section>
  );
};

export const DesignWorkspace: React.FC<DesignWorkspaceProps> = (props) => (
  <ReactFlowProvider>
    <DesignWorkspaceInner {...props} />
  </ReactFlowProvider>
);
