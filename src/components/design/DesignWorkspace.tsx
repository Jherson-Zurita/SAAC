import React, { useEffect, useMemo, useState } from 'react';
import type { AnalysisRunSummary } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import { ComparisonPanel } from './ComparisonPanel';
import { DesignCanvas } from './DesignCanvas';
import { DesignInspector } from './DesignInspector';
import { DesignSidebar } from './DesignSidebar';
import { DesignToolbar } from './DesignToolbar';

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

export const DesignWorkspace: React.FC<DesignWorkspaceProps> = ({
  projectPath,
  analysisRuns,
}) => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const isLoading = useDesignStore((state) => state.isLoading);
  const isDirty = useDesignStore((state) => state.isDirty);
  const saveStatus = useDesignStore((state) => state.saveStatus);
  const error = useDesignStore((state) => state.error);
  const changeVersion = useDesignStore((state) => state.changeVersion);
  const save = useDesignStore((state) => state.save);
  const undo = useDesignStore((state) => state.undo);
  const redo = useDesignStore((state) => state.redo);
  const clearError = useDesignStore((state) => state.clearError);
  const comparisonReport = useDesignStore((state) => state.comparisonReport);
  const [autoLayoutRequest, setAutoLayoutRequest] = useState(0);

  const currentAnalysisRunId = useMemo(
    () =>
      analysisRuns.length > 0
        ? analysisRuns[analysisRuns.length - 1].runId
        : null,
    [analysisRuns]
  );
  const compareRunId = currentDesign?.basedOnAnalysisRunId ?? currentAnalysisRunId;

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const commandKey = event.ctrlKey || event.metaKey;
      if (!commandKey) return;

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (useDesignStore.getState().currentDesign) {
          void save(projectPath).catch(() => undefined);
        }
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectPath, redo, save, undo]);

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
            <p className="design-workspace__state-title">Cargando diseño…</p>
          </div>
        )}

        {!isLoading && !currentDesign && (
          <div className="design-workspace__state design-workspace__state--empty">
            <h1 className="design-workspace__state-title">Diseña la arquitectura futura</h1>
            <p className="design-workspace__state-description">
              Crea un diseño desde cero o parte del AMG actual desde la barra lateral.
            </p>
          </div>
        )}

        {currentDesign && (
          <div className="design-workspace__editor">
            <DesignToolbar
              projectPath={projectPath}
              compareRunId={compareRunId}
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

            {comparisonReport && <ComparisonPanel />}
          </div>
        )}
      </main>
    </section>
  );
};
