import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Boxes,
  CopyPlus,
  FilePlus2,
  GitBranchPlus,
  Globe2,
  LayoutTemplate,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { ProposedNodeType } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  DESIGN_NODE_MIME,
  DESIGN_TEMPLATE_MIME,
  createNodeDragPayload,
  getDefaultNodeLabel,
  normalizeSearchText,
} from './design-flow';
import { DESIGN_TEMPLATES } from './design-templates';
import { useDesignPlacement } from './useDesignPlacement';

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

const LIST_FILTER_THRESHOLD = 5;

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

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
  const ensureProject = useDesignStore((state) => state.ensureProject);
  const list = useDesignStore((state) => state.list);
  const open = useDesignStore((state) => state.open);
  const create = useDesignStore((state) => state.create);
  const duplicate = useDesignStore((state) => state.duplicate);
  const deleteDesign = useDesignStore((state) => state.delete);
  const addNode = useDesignStore((state) => state.addNode);
  const setSelection = useDesignStore((state) => state.setSelection);
  const setEditingNode = useDesignStore((state) => state.setEditingNode);
  const { getNewNodePosition, placeFragment } = useDesignPlacement();
  const [newDesignName, setNewDesignName] = useState('');
  const [filter, setFilter] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    ensureProject(projectPath);
    void list(projectPath).catch(() => undefined);
  }, [ensureProject, list, projectPath]);

  const filteredDesigns = useMemo(() => {
    const normalized = normalizeSearchText(filter);
    if (!normalized) return designs;
    return designs.filter((design) => normalizeSearchText(design.name).includes(normalized));
  }, [designs, filter]);

  const runPending = async (name: string, action: () => Promise<unknown>) => {
    setPendingAction(name);
    try {
      await action();
      return true;
    } catch {
      // The workspace renders the store error.
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const createDesign = async (basedOnRunId: string | null) => {
    const name = newDesignName.trim() || (basedOnRunId ? 'Evolución del AMG actual' : 'Nueva arquitectura');
    const created = await runPending(basedOnRunId ? 'create-from-amg' : 'create-empty', () =>
      create(projectPath, name, basedOnRunId)
    );
    if (created) setNewDesignName('');
  };

  const handleDelete = async (designId: string, designName: string) => {
    if (!window.confirm(`¿Eliminar el diseño “${designName}” y sus snapshots?`)) return;
    await runPending(`delete-${designId}`, () => deleteDesign(projectPath, designId));
  };

  const ensureDesign = async () => {
    if (useDesignStore.getState().currentDesign) return true;
    return runPending('create-empty', () => create(projectPath, 'Nueva arquitectura', null));
  };

  const handlePaletteClick = async (type: ProposedNodeType) => {
    if (!(await ensureDesign())) return;
    const node = addNode(type, getDefaultNodeLabel(type), getNewNodePosition());
    if (node) {
      setSelection([node.id], []);
      setEditingNode(node.id);
    }
  };

  const handleTemplateClick = async (templateId: string) => {
    const template = DESIGN_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    if (!useDesignStore.getState().currentDesign) {
      const created = await runPending(`template-${templateId}`, () =>
        create(projectPath, newDesignName.trim() || template.name, null, template.description)
      );
      if (!created) return;
      setNewDesignName('');
    }
    placeFragment(template.fragment);
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createDesign(null);
            }}
            placeholder="Ej. Migración a microservicios"
          />
        </label>

        <div className="design-sidebar__create-actions">
          <button
            type="button"
            className="design-sidebar__create-button"
            onClick={() => void createDesign(null)}
            disabled={pendingAction !== null}
            title="Lienzo vacío para planificar una arquitectura nueva"
          >
            <FilePlus2 aria-hidden="true" />
            <span>{pendingAction === 'create-empty' ? 'Creando…' : 'Desde cero'}</span>
          </button>
          <button
            type="button"
            className="design-sidebar__create-button design-sidebar__create-button--primary"
            onClick={() => currentAnalysisRunId && void createDesign(currentAnalysisRunId)}
            disabled={!currentAnalysisRunId || pendingAction !== null}
            title={currentAnalysisRunId ? `Partir de la arquitectura real (corrida ${currentAnalysisRunId})` : 'Ejecuta un análisis para poder partir del AMG'}
          >
            <GitBranchPlus aria-hidden="true" />
            <span>{pendingAction === 'create-from-amg' ? 'Clonando…' : 'Desde AMG actual'}</span>
          </button>
        </div>

        {designs.length > LIST_FILTER_THRESHOLD && (
          <label className="design-sidebar__filter">
            <Search aria-hidden="true" />
            <input
              className="design-sidebar__filter-input"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar diseños…"
              aria-label="Filtrar diseños"
            />
          </label>
        )}

        <div className="design-sidebar__list" aria-busy={isLoading}>
          {isLoading && designs.length === 0 && (
            <p className="design-sidebar__message">Cargando diseños…</p>
          )}
          {!isLoading && designs.length === 0 && (
            <p className="design-sidebar__message">Todavía no hay diseños guardados.</p>
          )}
          {designs.length > 0 && filteredDesigns.length === 0 && (
            <p className="design-sidebar__message">Ningún diseño coincide con el filtro.</p>
          )}
          {filteredDesigns.map((design) => {
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
                  title={design.description ?? design.name}
                >
                  <span className="design-sidebar__design-name">{design.name}</span>
                  <span className="design-sidebar__design-meta">
                    <span
                      className={`design-sidebar__design-base design-sidebar__design-base--${design.basedOnAnalysisRunId ? 'amg' : 'scratch'}`}
                    >
                      {design.basedOnAnalysisRunId ? 'AMG' : 'Cero'}
                    </span>
                    {design.nodeCount} nodos · {design.edgeCount} aristas · {formatRelativeDate(design.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="design-sidebar__design-action"
                  onClick={() =>
                    void runPending(`duplicate-${design.id}`, () => duplicate(projectPath, design.id))
                  }
                  disabled={pendingAction !== null}
                  aria-label={`Duplicar ${design.name}`}
                  title="Duplicar como nueva propuesta"
                >
                  <CopyPlus aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="design-sidebar__design-action design-sidebar__design-delete"
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
        <p className="design-sidebar__hint">Arrastra al lienzo o haz clic para añadir en el centro.</p>
        <div className="design-sidebar__palette">
          {PALETTE.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                role="button"
                tabIndex={0}
                className={`design-sidebar__palette-item design-sidebar__palette-item--${item.type}`}
                draggable
                onClick={() => void handlePaletteClick(item.type)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void handlePaletteClick(item.type);
                  }
                }}
                title={`Hacer clic o arrastrar para añadir ${item.label}`}
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

      <section className="design-sidebar__section">
        <header className="design-sidebar__section-header">
          <h2 className="design-sidebar__title">Plantillas</h2>
        </header>
        <p className="design-sidebar__hint">
          Patrones de partida editables. Sin diseño abierto, crean uno nuevo.
        </p>
        <div className="design-sidebar__palette">
          {DESIGN_TEMPLATES.map((template) => (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              className="design-sidebar__palette-item design-sidebar__palette-item--template"
              draggable={Boolean(currentDesign)}
              aria-disabled={pendingAction !== null}
              onClick={() => pendingAction === null && void handleTemplateClick(template.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void handleTemplateClick(template.id);
                }
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData(DESIGN_TEMPLATE_MIME, template.id);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              title={`${template.description} (${template.fragment.nodes.length} componentes)`}
            >
              <LayoutTemplate className="design-sidebar__palette-icon" aria-hidden="true" />
              <span className="design-sidebar__palette-copy">
                <strong className="design-sidebar__palette-label">
                  {pendingAction === `template-${template.id}` ? 'Creando…' : template.name}
                </strong>
                <span className="design-sidebar__palette-description">{template.description}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};
