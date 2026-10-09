import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, FileCode2 } from 'lucide-react';
import { useUiStore, type MainTab } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useDiagramStore, type C4Level } from '../../stores/useDiagramStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { supplementaryDiagramDefinitions } from '../c4viewer/diagram-registry';
import { exportArchitectureReport } from '../../lib/export-report';
import { DEMO_PROJECT_PATH } from '../../lib/demo-data';

export interface CommandPaletteActions {
  onOpenProject: () => void;
  onAnalyzeProject: () => void;
  onCancelAnalysis: () => void;
  onCloseProject?: () => void;
  onLoadDemo?: () => void;
}

interface PaletteCommand {
  id: string;
  title: string;
  group: string;
  hint?: string;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

const MAX_MODULE_RESULTS = 30;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Puntaje de coincidencia: substring > inicio de palabra > subsecuencia; `null` si no coincide. */
function matchScore(query: string, text: string): number | null {
  if (!query) return 0;
  const idx = text.indexOf(query);
  if (idx >= 0) return 1000 - idx - (idx > 0 && /\w/.test(text[idx - 1]) ? 200 : 0);
  let ti = 0;
  let gaps = 0;
  for (const ch of query) {
    const found = text.indexOf(ch, ti);
    if (found < 0) return null;
    gaps += found - ti;
    ti = found + 1;
  }
  return 300 - gaps;
}

export const CommandPalette: React.FC<CommandPaletteActions> = (actions) => {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveMainTab, setSettingsOpen, toggleLeftbar, toggleRightbar, toggleDownbar, setTheme, theme } =
    useUiStore();
  const { amg, projectPath, isAnalyzing } = useProjectStore();
  const { selectElement } = useSelectionStore();
  const { setC4Level } = useDiagramStore();
  const saveSettings = useSettingsStore((s) => s.save);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];
    const add = (cmd: PaletteCommand | false | null | undefined) => {
      if (cmd) list.push(cmd);
    };
    const canAnalyze = Boolean(projectPath && projectPath !== DEMO_PROJECT_PATH && !isAnalyzing);
    const goTo = (tab: MainTab) => () => setActiveMainTab(tab);
    const goToC4 = (level: C4Level) => () => {
      setC4Level(level);
      setActiveMainTab('c4');
    };

    add({ id: 'open', title: 'Abrir proyecto…', group: 'Proyecto', shortcut: 'Ctrl+O', keywords: 'carpeta folder', run: actions.onOpenProject });
    add(canAnalyze && { id: 'analyze', title: amg ? 'Reanalizar proyecto' : 'Analizar proyecto', group: 'Proyecto', shortcut: 'Ctrl+Shift+A', run: actions.onAnalyzeProject });
    add(isAnalyzing && { id: 'cancel', title: 'Cancelar análisis en curso', group: 'Proyecto', run: actions.onCancelAnalysis });
    add(Boolean(amg && actions.onCloseProject) && { id: 'close', title: 'Cerrar proyecto', group: 'Proyecto', run: () => actions.onCloseProject?.() });
    add(Boolean(actions.onLoadDemo) && { id: 'demo', title: 'Cargar modo demo', group: 'Proyecto', run: () => actions.onLoadDemo?.() });

    if (amg) {
      add({ id: 'export-md', title: 'Exportar informe (Markdown)', group: 'Exportar', shortcut: 'Ctrl+Shift+E', keywords: 'reporte md adr metricas antipatrones', run: () => void exportArchitectureReport('markdown') });
      add({ id: 'export-pdf', title: 'Exportar informe (PDF)', group: 'Exportar', keywords: 'reporte adr metricas antipatrones', run: () => void exportArchitectureReport('pdf') });

      const views: Array<[MainTab, string]> = [
        ['dashboard', 'Dashboard'],
        ['modules', 'Catálogo de módulos'],
        ['code', 'Código IDE'],
        ['metrics', 'Métricas'],
        ['antipatterns', 'Antipatrones'],
        ['adrs', 'ADRs y riesgos'],
        ['design', 'Diseño de arquitecturas'],
      ];
      for (const [tab, title] of views) add({ id: `view-${tab}`, title: `Ir a: ${title}`, group: 'Navegación', run: goTo(tab) });

      add({ id: 'c4-1', title: 'C4 Nivel 1 — Contexto', group: 'Diagramas', shortcut: 'Alt+1', run: goToC4(1) });
      add({ id: 'c4-2', title: 'C4 Nivel 2 — Contenedores', group: 'Diagramas', shortcut: 'Alt+2', run: goToC4(2) });
      add({ id: 'c4-3', title: 'C4 Nivel 3 — Componentes', group: 'Diagramas', shortcut: 'Alt+3', run: goToC4(3) });
      for (const def of supplementaryDiagramDefinitions) {
        add({ id: `diagram-${def.tab}`, title: def.title, group: 'Diagramas', run: goTo(def.tab) });
      }
    }

    add({ id: 'settings', title: 'Abrir configuración', group: 'Configuración', shortcut: 'Ctrl+,', keywords: 'preferencias ajustes opciones', run: () => setSettingsOpen(true) });
    add({
      id: 'theme',
      title: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
      group: 'Configuración',
      keywords: 'tema dark light modo',
      run: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        saveSettings({ defaultTheme: next }).catch((err) => console.warn('No se pudo guardar el tema:', err));
      },
    });
    add({ id: 'toggle-left', title: 'Mostrar/ocultar explorador', group: 'Vista', shortcut: 'Ctrl+B', run: toggleLeftbar });
    add({ id: 'toggle-bottom', title: 'Mostrar/ocultar panel inferior', group: 'Vista', shortcut: 'Ctrl+J', run: toggleDownbar });
    add({ id: 'toggle-right', title: 'Mostrar/ocultar inspector', group: 'Vista', shortcut: 'Ctrl+Shift+R', run: toggleRightbar });

    return list;
  }, [actions, amg, projectPath, isAnalyzing, theme, setActiveMainTab, setC4Level, setSettingsOpen, setTheme, saveSettings, toggleLeftbar, toggleRightbar, toggleDownbar]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const scored = commands
      .map((cmd) => ({ cmd, score: matchScore(q, normalize(`${cmd.title} ${cmd.group} ${cmd.keywords ?? ''}`)) }))
      .filter((r): r is { cmd: PaletteCommand; score: number } => r.score !== null);
    if (q) scored.sort((a, b) => b.score - a.score);

    // Los módulos solo se listan al escribir, para no inundar la paleta.
    if (amg && q.length >= 2) {
      const modules = amg.modules
        .map((mod) => ({ mod, score: matchScore(q, normalize(mod.name)) ?? matchScore(q, normalize(mod.id)) }))
        .filter((r): r is { mod: (typeof amg.modules)[number]; score: number } => r.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MODULE_RESULTS)
        .map(({ mod, score }) => ({
          score: score - 50,
          cmd: {
            id: `module-${mod.id}`,
            title: mod.name,
            group: 'Módulos',
            hint: mod.id,
            run: () => {
              selectElement(mod.id, 'module', mod);
              setActiveMainTab('code');
            },
          } satisfies PaletteCommand,
        }));
      scored.push(...modules);
    }
    return scored.map((r) => r.cmd);
  }, [commands, query, amg, selectElement, setActiveMainTab]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!commandPaletteOpen) return null;

  const close = () => setCommandPaletteOpen(false);
  const runAt = (index: number) => {
    const cmd = results[index];
    if (!cmd) return;
    close();
    cmd.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-[12vh] bg-black/40 font-sans text-xs" onMouseDown={close}>
      <div
        className="w-[560px] max-w-[92vw] bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-2)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={amg ? 'Busca un comando, vista, diagrama o módulo…' : 'Busca un comando…'}
            className="flex-1 bg-transparent px-2.5 py-3 text-[13px] text-[var(--text)] focus:outline-none placeholder:text-[var(--muted-2)]"
          />
          <kbd className="text-[9px] font-mono text-[var(--muted-2)] border border-[var(--border-soft)] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[var(--muted-2)]">Sin resultados para «{query}».</p>
          ) : (
            results.map((cmd, index) => {
              const showGroup = cmd.group !== lastGroup && !query.trim();
              lastGroup = cmd.group;
              const active = index === activeIndex;
              return (
                <React.Fragment key={cmd.id}>
                  {showGroup && (
                    <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                      {cmd.group}
                    </div>
                  )}
                  <div
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => runAt(index)}
                    className={`mx-1 px-2.5 py-1.5 rounded flex items-center justify-between cursor-pointer ${
                      active ? 'bg-[var(--purple-soft)] text-[var(--purple)]' : 'text-[var(--text)]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {cmd.group === 'Módulos' && <FileCode2 className="w-3.5 h-3.5 shrink-0 text-[var(--cyan)]" />}
                      <span className="truncate">{cmd.title}</span>
                      {cmd.hint && <span className="truncate text-[10px] font-mono text-[var(--muted-2)]">{cmd.hint}</span>}
                      {query.trim() && cmd.group !== 'Módulos' && (
                        <span className="text-[10px] text-[var(--muted-2)] shrink-0">{cmd.group}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 pl-2">
                      {cmd.shortcut && (
                        <kbd className="text-[9px] font-mono text-[var(--muted-2)] border border-[var(--border-soft)] rounded px-1.5 py-0.5">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {active && <CornerDownLeft className="w-3 h-3" />}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
