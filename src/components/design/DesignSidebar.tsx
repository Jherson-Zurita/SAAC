import React, { useEffect, useState } from 'react';
import {
  Box,
  Boxes,
  FilePlus2,
  GitBranchPlus,
  Globe2,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { ProposedNodeType } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  DESIGN_NODE_MIME,
  createNodeDragPayload,
} from './design-flow';

const PALETTE: readonly {
  type: ProposedNodeType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { type: 'module', label: 'Módulo', description: 'Unidad lógica de código', icon: Boxes },
  { type: 'container', label: 'Contenedor', description: 'Unidad desplegable', icon: Box },
  {
    type: 'external-system',
    label: 'Sistema externo',
    description: 'Dependencia fuera del sistema',
    icon: Globe2,
  },
  { type: 'actor', label: 'Actor', description: 'Persona o rol del sistema', icon: UserRound },
];

export interface DesignSidebarProps {
  projectPath: string;
  currentAnalysisRunId?: string | null;
}

export const DesignSidebar: React.FC<DesignSidebarProps> = ({
  projectPath,
  currentAnalysisRunId,
}) => {
  const designs = useDesignStore((state) => state.designs);
  const currentDesign = useDesignStore((state) => state.currentDesign);
  const isLoading = useDesignStore((state) => state.isLoading);
  const list = useDesignStore((state) => state.list);
  const open = useDesignStore((state) => state.open);
  const create = useDesignStore((state) => state.create);
  const deleteDesign = useDesignStore((state) => state.delete);
  const reset = useDesignStore((state) => state.reset);
  const [newDesignName, setNewDesignName] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    reset();
    void list(projectPath).catch(() => undefined);
  }, [list, projectPath, reset]);

  const createDesign = async (basedOnRunId: string | null) => {
    const name = newDesignName.trim() || 'Nueva arquitectura';
    setPendingAction(basedOnRunId ? 'create-from-amg' : 'create-empty');
    try {
      await create(projectPath, name, basedOnRunId);
      setNewDesignName('');
    } catch {
      // The workspace renders the store error.
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (designId: string, designName: string) => {
    if (!window.confirm(`¿Eliminar el diseño “${designName}” y sus snapshots?`)) return;
    setPendingAction(`delete-${designId}`);
    try {
      await deleteDesign(projectPath, designId);
    } catch {
      // The workspace renders the store error.
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <aside className="design-sidebar" aria-label="Diseños y componentes">
      <section className="design-sidebar__section">
        <header className="design-sidebar__section-header">
          <h2 className="design-sidebar__title">Diseños</h2>
          <span className="design-sidebar__count">{designs.length}</span>
        </header>

        <label className="design-sidebar__field">
          <span className="design-sidebar__field-label">Nombre del nuevo diseño</span>
          <input
            className="design-sidebar__input"
            value={newDesignName}
            onChange={(event) => setNewDesignName(event.target.value)}
            placeholder="Ej. Migración a microservicios"
          />
        </label>

        <div className="design-sidebar__create-actions">
          <button
            type="button"
            className="design-sidebar__create-button"
            onClick={() => void createDesign(null)}
            disabled={pendingAction !== null}
          >
            <FilePlus2 aria-hidden="true" />
            <span>{pendingAction === 'create-empty' ? 'Creando…' : 'Desde cero'}</span>
          </button>
          <button
            type="button"
            className="design-sidebar__create-button design-sidebar__create-button--primary"
            onClick={() => currentAnalysisRunId && void createDesign(currentAnalysisRunId)}
            disabled={!currentAnalysisRunId || pendingAction !== null}
            title={currentAnalysisRunId ? `Usar corrida ${currentAnalysisRunId}` : 'No hay un AMG actual'}
          >
            <GitBranchPlus aria-hidden="true" />
            <span>{pendingAction === 'create-from-amg' ? 'Clonando…' : 'Desde AMG actual'}</span>
          </button>
        </div>

        <div className="design-sidebar__list" aria-busy={isLoading}>
          {isLoading && designs.length === 0 && (
            <p className="design-sidebar__message">Cargando diseños…</p>
          )}
          {!isLoading && designs.length === 0 && (
            <p className="design-sidebar__message">Todavía no hay diseños guardados.</p>
          )}
          {designs.map((design) => {
            const active = currentDesign?.id === design.id;
            return (
              <article
                key={design.id}
                className={`design-sidebar__design${active ? ' design-sidebar__design--active' : ''}`}
              >
                <button
                  type="button"
                  className="design-sidebar__design-open"
                  onClick={() => void open(projectPath, design.id).catch(() => undefined)}
                  disabled={pendingAction !== null}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="design-sidebar__design-name">{design.name}</span>
                  <span className="design-sidebar__design-meta">
                    {design.nodeCount} nodos · {design.edgeCount} aristas
                  </span>
                </button>
                <button
                  type="button"
                  className="design-sidebar__design-delete"
                  onClick={() => void handleDelete(design.id, design.name)}
                  disabled={pendingAction !== null}
                  aria-label={`Eliminar ${design.name}`}
                  title={`Eliminar ${design.name}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="design-sidebar__section design-sidebar__section--palette">
        <header className="design-sidebar__section-header">
          <h2 className="design-sidebar__title">Componentes</h2>
        </header>
        <p className="design-sidebar__hint">Arrastra un componente al canvas.</p>
        <div className="design-sidebar__palette">
          {PALETTE.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                className={`design-sidebar__palette-item design-sidebar__palette-item--${item.type}`}
                draggable={Boolean(currentDesign)}
                aria-disabled={!currentDesign}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    DESIGN_NODE_MIME,
                    createNodeDragPayload(item.type)
                  );
                  event.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <Icon className="design-sidebar__palette-icon" aria-hidden="true" />
                <span className="design-sidebar__palette-copy">
                  <strong className="design-sidebar__palette-label">{item.label}</strong>
                  <span className="design-sidebar__palette-description">{item.description}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
