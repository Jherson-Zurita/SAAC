import React, { useState } from 'react';
import {
  Download,
  GitCompareArrows,
  LayoutDashboard,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import type { ExportFormat } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import { downloadDesignText } from './design-flow';

const EXPORT_OPTIONS: readonly { format: ExportFormat; label: string }[] = [
  { format: 'structurizr-dsl', label: 'Structurizr' },
  { format: 'plant-uml', label: 'PlantUML' },
  { format: 'mermaid', label: 'Mermaid' },
];

export interface DesignToolbarProps {
  projectPath: string;
  compareRunId?: string | null;
  onAutoLayout: () => void;
}

export const DesignToolbar: React.FC<DesignToolbarProps> = ({
  projectPath,
  compareRunId,
  onAutoLayout,
}) => {
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const history = useDesignStore((state) => state.history);
  const future = useDesignStore((state) => state.future);
  const isDirty = useDesignStore((state) => state.isDirty);
  const saveStatus = useDesignStore((state) => state.saveStatus);
  const undo = useDesignStore((state) => state.undo);
  const redo = useDesignStore((state) => state.redo);
  const save = useDesignStore((state) => state.save);
  const compare = useDesignStore((state) => state.compare);
  const exportDesign = useDesignStore((state) => state.exportDesign);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isSaving = saveStatus === 'saving';
  const isBusy = busyAction !== null || isSaving;

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusyAction(name);
    try {
      await action();
    } catch {
      // The store exposes the actionable error in the workspace.
    } finally {
      setBusyAction(null);
    }
  };

  const saveIfDirty = async () => {
    const state = useDesignStore.getState();
    if (state.isDirty) await state.save(projectPath);
  };

  const handleSave = () =>
    void runAction('save', async () => {
      await save(projectPath);
    });

  const handleCompare = () => {
    if (!compareRunId) return;
    void runAction('compare', async () => {
      await saveIfDirty();
      await compare(projectPath, compareRunId);
    });
  };

  const handleExport = (format: ExportFormat) =>
    void runAction(`export-${format}`, async () => {
      await saveIfDirty();
      const content = await exportDesign(projectPath, format);
      const design = useDesignStore.getState().currentDesign;
      if (content && design) downloadDesignText(design.name, format, content);
    });

  if (!currentDesign) return null;

  return (
    <header className="design-toolbar" aria-label="Herramientas de diseño">
      <div className="design-toolbar__identity">
        <h1 className="design-toolbar__title">{currentDesign.name}</h1>
        <span className={`design-toolbar__status design-toolbar__status--${saveStatus}`}>
          {saveStatus === 'saving'
            ? 'Guardando…'
            : isDirty
              ? 'Cambios sin guardar'
              : saveStatus === 'saved'
                ? 'Guardado'
                : saveStatus === 'error'
                  ? 'Error al guardar'
                  : 'Sin cambios'}
        </span>
      </div>

      <div className="design-toolbar__group" role="group" aria-label="Historial y distribución">
        <button
          type="button"
          className="design-toolbar__button"
          onClick={undo}
          disabled={history.length === 0 || isBusy}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 aria-hidden="true" />
          <span>Deshacer</span>
        </button>
        <button
          type="button"
          className="design-toolbar__button"
          onClick={redo}
          disabled={future.length === 0 || isBusy}
          title="Rehacer (Ctrl+Y o Ctrl+Shift+Z)"
        >
          <Redo2 aria-hidden="true" />
          <span>Rehacer</span>
        </button>
        <button
          type="button"
          className="design-toolbar__button"
          onClick={onAutoLayout}
          disabled={currentDesign.nodes.length === 0 || isBusy}
          title="Distribuir nodos automáticamente"
        >
          <LayoutDashboard aria-hidden="true" />
          <span>Autolayout</span>
        </button>
      </div>

      <div className="design-toolbar__group" role="group" aria-label="Persistencia y comparación">
        <button
          type="button"
          className="design-toolbar__button design-toolbar__button--primary"
          onClick={handleSave}
          disabled={!isDirty || isBusy}
          title="Guardar diseño (Ctrl+S)"
        >
          <Save aria-hidden="true" />
          <span>{busyAction === 'save' || isSaving ? 'Guardando…' : 'Guardar'}</span>
        </button>
        <button
          type="button"
          className="design-toolbar__button"
          onClick={handleCompare}
          disabled={!compareRunId || isBusy}
          title={compareRunId ? `Comparar contra ${compareRunId}` : 'No hay una corrida base disponible'}
        >
          <GitCompareArrows aria-hidden="true" />
          <span>{busyAction === 'compare' ? 'Comparando…' : 'Comparar'}</span>
        </button>
      </div>

      <div className="design-toolbar__exports" role="group" aria-label="Exportar diseño">
        <Download className="design-toolbar__exports-icon" aria-hidden="true" />
        {EXPORT_OPTIONS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            className="design-toolbar__export"
            onClick={() => handleExport(format)}
            disabled={isBusy}
            title={`Exportar como ${label}`}
          >
            {busyAction === `export-${format}` ? 'Exportando…' : label}
          </button>
        ))}
      </div>
    </header>
  );
};
