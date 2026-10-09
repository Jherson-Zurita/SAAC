import React, { useEffect, useRef, useState } from 'react';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  ClipboardCopy,
  Download,
  GitCompareArrows,
  LayoutDashboard,
  Redo2,
  Save,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import type { ExportFormat } from '../../../shared/types';
import { saveProposedArchitectureExport } from '../../lib/tauri-api';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  EXPORT_OPTIONS,
  getExportExtension,
  getExportFileName,
  type DesignIssue,
} from './design-flow';

export interface DesignToolbarProps {
  projectPath: string;
  compareRunId?: string | null;
  issues: DesignIssue[];
  validationOpen: boolean;
  onToggleValidation: () => void;
  onAutoLayout: () => void;
}

export const DesignToolbar: React.FC<DesignToolbarProps> = ({
  projectPath,
  compareRunId,
  issues,
  validationOpen,
  onToggleValidation,
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
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const isSaving = saveStatus === 'saving';
  const isBusy = busyAction !== null || isSaving;
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  useEffect(() => {
    if (!exportOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [exportOpen]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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

  const handleExportToFile = (format: ExportFormat, label: string) => {
    setExportOpen(false);
    void runAction(`export-${format}`, async () => {
      const design = useDesignStore.getState().currentDesign;
      if (!design) return;
      const targetPath = await saveDialog({
        defaultPath: getExportFileName(design.name, format),
        filters: [{ name: label, extensions: [getExportExtension(format)] }],
      });
      if (!targetPath) return;
      await saveIfDirty();
      try {
        await saveProposedArchitectureExport(projectPath, design.id, format, targetPath);
        setNotice(`Exportado como ${label}`);
      } catch (error) {
        useDesignStore.setState({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  };

  const handleCopy = (format: ExportFormat, label: string) => {
    setExportOpen(false);
    void runAction(`copy-${format}`, async () => {
      await saveIfDirty();
      const content = await exportDesign(projectPath, format);
      if (!content) return;
      await navigator.clipboard.writeText(content);
      setNotice(`${label} copiado al portapapeles`);
    });
  };

  if (!currentDesign) return null;

  return (
    <header className="design-toolbar" aria-label="Herramientas de diseño">
      <div className="design-toolbar__identity">
        <h1 className="design-toolbar__title">{currentDesign.name}</h1>
        <span
          className={`design-toolbar__status design-toolbar__status--${notice ? 'saved' : saveStatus}`}
          role="status"
        >
          {notice
            ? notice
            : saveStatus === 'saving'
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
          title="Distribuir nodos automáticamente (se puede deshacer)"
        >
          <LayoutDashboard aria-hidden="true" />
          <span>Autolayout</span>
        </button>
      </div>

      <div className="design-toolbar__group" role="group" aria-label="Calidad del diseño">
        <button
          type="button"
          className={`design-toolbar__button${validationOpen ? ' design-toolbar__button--active' : ''}`}
          onClick={onToggleValidation}
          aria-pressed={validationOpen}
          title="Revisar reglas arquitectónicas del diseño"
        >
          <ShieldCheck aria-hidden="true" />
          <span>Validar</span>
          {issues.length > 0 && (
            <span
              className={`design-toolbar__badge design-toolbar__badge--${errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info'}`}
            >
              {issues.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className="design-toolbar__button"
          onClick={handleCompare}
          disabled={!compareRunId || isBusy}
          title={compareRunId ? `Compara el diseño propuesto contra la arquitectura real obtenida por el escáner (Corrida ${compareRunId})` : 'No hay un análisis AMG base para comparar'}
        >
          <GitCompareArrows aria-hidden="true" />
          <span>{busyAction === 'compare' ? 'Comparando…' : 'Comparar vs AMG'}</span>
        </button>
      </div>

      <div className="design-toolbar__group" role="group" aria-label="Persistencia y exportación">
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

        <div className="design-toolbar__menu" ref={exportRef}>
          <button
            type="button"
            className="design-toolbar__button"
            onClick={() => setExportOpen((value) => !value)}
            disabled={isBusy || currentDesign.nodes.length === 0}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            title="Exportar a Structurizr, PlantUML o Mermaid"
          >
            <Download aria-hidden="true" />
            <span>{busyAction?.startsWith('export') || busyAction?.startsWith('copy') ? 'Exportando…' : 'Exportar'}</span>
          </button>
          {exportOpen && (
            <div className="design-toolbar__menu-list" role="menu">
              {EXPORT_OPTIONS.map(({ format, label }) => (
                <div key={format} className="design-toolbar__menu-row" role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="design-toolbar__menu-item"
                    onClick={() => handleExportToFile(format, label)}
                  >
                    <Download aria-hidden="true" />
                    <span>{label}</span>
                    <code>.{getExportExtension(format)}</code>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="design-toolbar__menu-copy"
                    onClick={() => handleCopy(format, label)}
                    title={`Copiar ${label} al portapapeles`}
                    aria-label={`Copiar ${label} al portapapeles`}
                  >
                    <ClipboardCopy aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
