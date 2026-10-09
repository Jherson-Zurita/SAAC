import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileCode2,
  Search,
  Braces,
  Box,
  Copy,
  Check,
  Layers,
  X,
  Code2,
  ArrowRightLeft,
  FileText,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useUiStore } from '../../stores/useUiStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { getModuleGroupColor } from '../../lib/color-utils';
import { readModuleSource } from '../../lib/tauri-api';
import { DEMO_PROJECT_PATH } from '../../lib/demo-data';
import type { Module, ClassInfo, FunctionInfo, ModuleSource } from '../../../shared/types';

type SourceEntry =
  | { status: 'loading' }
  | { status: 'loaded'; source: ModuleSource }
  | { status: 'error'; message: string };

const PRISM_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'tsx',
  tsx: 'tsx',
  js: 'jsx',
  jsx: 'jsx',
  py: 'python',
  pyi: 'python',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  swift: 'swift',
  go: 'go',
  rs: 'rust',
};

/** Por encima de este tamaño el resaltado de Prism bloquea la UI; se muestra texto plano. */
const MAX_HIGHLIGHT_BYTES = 300 * 1024;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ubica (heurísticamente) la línea 1-based donde se declara `name`, a partir de `fromLine`. */
function findDeclarationLine(lines: string[], name: string, fromLine = 1): number | null {
  const n = escapeRegExp(name);
  const patterns = [
    new RegExp(
      `\\b(class|interface|struct|enum|trait|protocol|object|record|type|def|fn|func|function|fun)\\s+${n}\\b`
    ),
    new RegExp(`\\bfunc\\s*\\([^)]*\\)\\s*${n}\\b`),
    new RegExp(`\\b${n}\\s*[=:]\\s*(async\\s*)?(\\(|function\\b)`),
    new RegExp(`\\b${n}\\s*(<[^>]*>)?\\s*\\(`),
  ];
  for (const re of patterns) {
    for (let i = Math.max(0, fromLine - 1); i < lines.length; i++) {
      if (re.test(lines[i])) return i + 1;
    }
  }
  return null;
}

export const CodeIdeView: React.FC = () => {
  const { amg, projectPath } = useProjectStore();
  const { selectedId, selectElement } = useSelectionStore();
  const { setActiveMainTab, theme } = useUiStore();
  const { setC4Level } = useDiagramStore();

  const [viewMode, setViewMode] = useState<'source' | 'ast'>('source');
  const [sources, setSources] = useState<Record<string, SourceEntry>>({});
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);

  const modules = amg?.modules || [];

  // Módulo activo seleccionado o primero de la lista
  const activeModule = useMemo(() => {
    if (!modules.length) return null;
    if (selectedId) {
      const found = modules.find((m) => m.id === selectedId);
      if (found) return found;
    }
    return modules[0];
  }, [modules, selectedId]);

  // Lista de archivos abiertos en pestañas del IDE
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    return activeModule ? [activeModule.id] : [];
  });

  const [searchFile, setSearchFile] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeOutlineSection, setActiveOutlineSection] = useState<'all' | 'classes' | 'functions' | 'imports'>('all');

  // Asegurar que si cambia el seleccionado externamente se abra la pestaña
  React.useEffect(() => {
    if (activeModule && !openTabs.includes(activeModule.id)) {
      setOpenTabs((prev) => [...prev, activeModule.id]);
    }
  }, [activeModule]);

  const handleSelectModule = (mod: Module) => {
    selectElement(mod.id, 'module', mod);
    if (!openTabs.includes(mod.id)) {
      setOpenTabs((prev) => [...prev, mod.id]);
    }
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = openTabs.filter((t) => t !== id);
    setOpenTabs(filtered);
    if (activeModule?.id === id && filtered.length > 0) {
      const next = modules.find((m) => m.id === filtered[filtered.length - 1]);
      if (next) selectElement(next.id, 'module', next);
    }
  };

  const filteredModules = useMemo(() => {
    if (!searchFile.trim()) return modules;
    const q = searchFile.toLowerCase();
    return modules.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [modules, searchFile]);

  // Generación de código estilizado AST simulado/reconstruido a partir del mapa de módulo
  const generatedCodeLines = useMemo(() => {
    if (!activeModule) return [];

    const lines: Array<{ num: number; text: string; type?: 'import' | 'class' | 'method' | 'function' | 'comment' | 'plain'; meta?: any }> = [];
    let lineNum = 1;

    // Header comments
    lines.push({
      num: lineNum++,
      text: `/**`,
      type: 'comment',
    });
    lines.push({
      num: lineNum++,
      text: ` * SAAC AST Code Inspector — ${activeModule.name}`,
      type: 'comment',
    });
    lines.push({
      num: lineNum++,
      text: ` * Módulo: ${activeModule.id}`,
      type: 'comment',
    });
    lines.push({
      num: lineNum++,
      text: ` * Lenguaje: ${activeModule.language} | LOC: ${activeModule.loc} | Mantenibilidad Index: ${Math.round(activeModule.metrics.maintainabilityIndex)}`,
      type: 'comment',
    });
    lines.push({
      num: lineNum++,
      text: ` */`,
      type: 'comment',
    });
    lines.push({ num: lineNum++, text: ``, type: 'plain' });

    // Imports section
    if (activeModule.imports.length > 0) {
      lines.push({ num: lineNum++, text: `// ── DEPENDENCIAS E IMPORTACIONES DE MÓDULO ──`, type: 'comment' });
      activeModule.imports.forEach((imp) => {
        lines.push({
          num: lineNum++,
          text: `import { ... } from '${imp}';`,
          type: 'import',
          meta: imp,
        });
      });
      lines.push({ num: lineNum++, text: ``, type: 'plain' });
    }

    // Classes section
    if (activeModule.classes.length > 0) {
      lines.push({ num: lineNum++, text: `// ── CLASES E INTERFACES DECLARADAS ──`, type: 'comment' });
      activeModule.classes.forEach((cls: ClassInfo) => {
        const extendsClause = cls.extends.length ? ` extends ${cls.extends.join(', ')}` : '';
        const implementsClause = cls.implements.length ? ` implements ${cls.implements.join(', ')}` : '';
        const kind = cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract class' : 'class';

        lines.push({
          num: lineNum++,
          text: `export ${kind} ${cls.name}${extendsClause}${implementsClause} {`,
          type: 'class',
          meta: cls,
        });

        // Attributes
        cls.attributes.forEach((attr) => {
          lines.push({
            num: lineNum++,
            text: `  ${attr.visibility} ${attr.isStatic ? 'static ' : ''}${attr.isReadonly ? 'readonly ' : ''}${attr.name}: ${attr.type};`,
            type: 'plain',
          });
        });

        if (cls.attributes.length && cls.methods.length) {
          lines.push({ num: lineNum++, text: ``, type: 'plain' });
        }

        // Methods
        cls.methods.forEach((method) => {
          const paramsStr = method.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
          lines.push({
            num: lineNum++,
            text: `  ${method.visibility} ${method.isStatic ? 'static ' : ''}${method.isAbstract ? 'abstract ' : ''}${method.name}(${paramsStr}): ${method.returnType} {`,
            type: 'method',
            meta: method,
          });
          lines.push({
            num: lineNum++,
            text: `    // [AST Metrics] CC: ${method.cyclomaticComplexity} | LOC: ${method.loc}`,
            type: 'comment',
          });
          lines.push({ num: lineNum++, text: `  }`, type: 'plain' });
        });

        lines.push({ num: lineNum++, text: `}`, type: 'plain' });
        lines.push({ num: lineNum++, text: ``, type: 'plain' });
      });
    }

    // Standalone Functions section
    if (activeModule.functions.length > 0) {
      lines.push({ num: lineNum++, text: `// ── FUNCIONES Y MÉTODOS EXPORTADOS ──`, type: 'comment' });
      activeModule.functions.forEach((fn: FunctionInfo) => {
        const paramsStr = fn.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
        lines.push({
          num: lineNum++,
          text: `${fn.isExported ? 'export ' : ''}function ${fn.name}(${paramsStr}): ${fn.returnType} {`,
          type: 'function',
          meta: fn,
        });
        lines.push({
          num: lineNum++,
          text: `  // [AST Execution Path] Complejidad Ciclomática: ${fn.cyclomaticComplexity} | LOC: ${fn.loc}`,
          type: 'comment',
        });
        if (fn.calls && fn.calls.length) {
          lines.push({
            num: lineNum++,
            text: `  // Invocaciones internas: ${fn.calls.join(', ')}`,
            type: 'comment',
          });
        }
        lines.push({ num: lineNum++, text: `}`, type: 'plain' });
        lines.push({ num: lineNum++, text: ``, type: 'plain' });
      });
    }

    // Fallback if empty
    if (!activeModule.classes.length && !activeModule.functions.length && !activeModule.imports.length) {
      lines.push({
        num: lineNum++,
        text: `// Este módulo no contiene declaraciones explícitas parseadas de clases o funciones.`,
        type: 'comment',
      });
    }

    return lines;
  }, [activeModule]);

  // Al cambiar de proyecto se descarta el código leído del anterior.
  useEffect(() => {
    setSources({});
  }, [projectPath]);

  const isDemo = projectPath === DEMO_PROJECT_PATH;

  const loadSource = (moduleId: string, force = false) => {
    if (!projectPath || isDemo) return;
    if (!force && sources[moduleId]) return;
    setSources((prev) => ({ ...prev, [moduleId]: { status: 'loading' } }));
    readModuleSource(projectPath, moduleId)
      .then((source) => setSources((prev) => ({ ...prev, [moduleId]: { status: 'loaded', source } })))
      .catch((err) =>
        setSources((prev) => ({ ...prev, [moduleId]: { status: 'error', message: String(err) } }))
      );
  };

  useEffect(() => {
    if (viewMode === 'source' && activeModule) loadSource(activeModule.id);
    setHighlightedLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule?.id, viewMode, projectPath]);

  const sourceEntry: SourceEntry | undefined = isDemo
    ? { status: 'error', message: 'El modo demo usa datos sintéticos: no hay archivos reales que mostrar.' }
    : activeModule
      ? sources[activeModule.id]
      : undefined;
  const loadedSource = sourceEntry?.status === 'loaded' ? sourceEntry.source : null;
  const sourceLines = useMemo(() => loadedSource?.content.split(/\r?\n/) ?? [], [loadedSource]);

  const modifiedAfterAnalysis = Boolean(
    loadedSource?.modifiedAt &&
      amg?.analyzedAt &&
      new Date(loadedSource.modifiedAt).getTime() > new Date(amg.analyzedAt).getTime()
  );

  useEffect(() => {
    if (highlightedLine === null) return;
    codeScrollRef.current
      ?.querySelector(`[data-line="${highlightedLine}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedLine]);

  const jumpToDeclaration = (name: string, className?: string) => {
    if (viewMode !== 'source' || !sourceLines.length) return;
    const classLine = className ? findDeclarationLine(sourceLines, className) : null;
    const line = findDeclarationLine(sourceLines, name, classLine ?? 1) ?? classLine;
    if (line) setHighlightedLine(line);
  };

  const handleCopyCode = () => {
    const text =
      viewMode === 'source' && loadedSource
        ? loadedSource.content
        : generatedCodeLines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const moduleColor = activeModule ? getModuleGroupColor(activeModule.id) : { hex: '#8B7CFF', hsl: 'hsl(246, 100%, 74%)', bg: 'rgba(139,124,255,0.1)', border: 'rgba(139,124,255,0.3)' };

  return (
    <div className="flex-1 flex h-full bg-[var(--bg)] font-sans text-xs select-none overflow-hidden">
      {/* 1. IDE Sidebar (Explorador de Archivos de Código) */}
      <aside className="w-[230px] bg-[var(--panel)] border-r border-[var(--border)] flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--panel-2)]">
          <div className="flex items-center space-x-2 text-[var(--purple)]">
            <Code2 className="w-4 h-4" />
            <span className="font-bold text-[11px] text-[var(--text)] uppercase tracking-wider">
              Código IDE
            </span>
          </div>
          <span className="text-[9px] font-mono text-[var(--muted-2)]">
            {modules.length} archivos
          </span>
        </div>

        {/* File Search */}
        <div className="p-2 border-b border-[var(--border)]">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[var(--muted-2)]" />
            <input
              type="text"
              placeholder="Buscar archivo código..."
              value={searchFile}
              onChange={(e) => setSearchFile(e.target.value)}
              className="w-full bg-[var(--bg)] text-[11px] text-[var(--text)] pl-7 pr-2 py-1 rounded border border-[var(--border)] focus:outline-none focus:border-[var(--purple)] font-sans placeholder:text-[var(--muted-2)]"
            />
          </div>
        </div>

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {filteredModules.map((mod) => {
            const isSelected = activeModule?.id === mod.id;
            const color = getModuleGroupColor(mod.id);
            const mi = Math.round(mod.metrics.maintainabilityIndex);
            const miColor = mi >= 80 ? 'var(--green)' : mi >= 60 ? 'var(--yellow)' : 'var(--red)';

            return (
              <div
                key={mod.id}
                onClick={() => handleSelectModule(mod)}
                className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition ${isSelected
                  ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-semibold border border-[var(--purple-border)]'
                  : 'hover:bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" style={{ color: color.hex }} />
                  <div className="truncate">
                    <div className="text-[11px] truncate">{mod.name}</div>
                    <div className="text-[9px] font-mono opacity-60 truncate">{mod.id}</div>
                  </div>
                </div>

                <span
                  className="text-[8px] font-mono px-1 py-0.2 rounded font-bold shrink-0 ml-1"
                  style={{ color: miColor, backgroundColor: `color-mix(in srgb, ${miColor} 15%, transparent)` }}
                >
                  {mi}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Central IDE Editor Container */}
      <div className="flex-1 flex flex-col h-full bg-[var(--diagram-canvas)] overflow-hidden">
        {/* IDE Tabs Bar */}
        <div className="h-9 bg-[var(--panel-2)] border-b border-[var(--border)] flex items-center overflow-x-auto px-1 space-x-1 shrink-0">
          {openTabs.map((tabId) => {
            const tabMod = modules.find((m) => m.id === tabId);
            if (!tabMod) return null;
            const isActive = activeModule?.id === tabId;
            const tabColor = getModuleGroupColor(tabMod.id);

            return (
              <div
                key={tabId}
                onClick={() => handleSelectModule(tabMod)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-t text-[11px] font-mono cursor-pointer border-t border-x transition shrink-0 ${isActive
                  ? 'bg-[var(--panel)] text-[var(--text)] border-[var(--border)] font-bold border-t-2'
                  : 'bg-[var(--panel-3)]/50 text-[var(--muted)] hover:text-[var(--text)] border-transparent'
                  }`}
                style={{ borderTopColor: isActive ? tabColor.hex : undefined }}
              >
                <FileCode2 className="w-3.5 h-3.5" style={{ color: tabColor.hex }} />
                <span>{tabMod.name}</span>
                <button
                  onClick={(e) => handleCloseTab(tabId, e)}
                  className="p-0.5 hover:text-[var(--red)] rounded transition"
                  title="Cerrar pestaña"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Active File Banner Header */}
        {activeModule && (
          <div className="px-4 py-2 bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 truncate">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: moduleColor.hex }}
              />
              <div className="truncate">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-[12px] text-[var(--text)] font-sans">
                    {activeModule.name}
                  </h3>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                    style={{
                      color: moduleColor.hex,
                      backgroundColor: moduleColor.bg,
                      border: `1px solid ${moduleColor.border}`,
                    }}
                  >
                    {activeModule.language}
                  </span>
                </div>
                <p
                  className="text-[9.5px] font-mono text-[var(--muted-2)] truncate"
                  title={loadedSource?.filePath ?? activeModule.id}
                >
                  {loadedSource && viewMode === 'source' ? loadedSource.relativePath : activeModule.id}
                </p>
              </div>
              {viewMode === 'source' && modifiedAfterAnalysis && (
                <span
                  className="flex items-center space-x-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--yellow)]/10 text-[var(--yellow)] border border-[var(--yellow)]/30 shrink-0"
                  title="El archivo cambió después del último análisis: las métricas pueden no coincidir con el código mostrado."
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Modificado tras el análisis</span>
                </span>
              )}
            </div>

            {/* Metrics & Actions */}
            <div className="flex items-center space-x-3 shrink-0">
              <div className="flex items-center rounded border border-[var(--border-soft)] overflow-hidden text-[10px] font-medium">
                <button
                  onClick={() => setViewMode('source')}
                  className={`flex items-center space-x-1 px-2 py-1 transition ${viewMode === 'source' ? 'bg-[var(--purple-soft)] text-[var(--purple)]' : 'bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  title="Código fuente real del archivo"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Fuente</span>
                </button>
                <button
                  onClick={() => setViewMode('ast')}
                  className={`flex items-center space-x-1 px-2 py-1 transition border-l border-[var(--border-soft)] ${viewMode === 'ast' ? 'bg-[var(--purple-soft)] text-[var(--purple)]' : 'bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  title="Estructura reconstruida a partir del AMG"
                >
                  <Braces className="w-3.5 h-3.5" />
                  <span>AST</span>
                </button>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono bg-[var(--panel-2)] px-2.5 py-1 rounded border border-[var(--border-soft)]">
                <span>LOC: <strong className="text-[var(--text)]">{activeModule.loc}</strong></span>
                <span>MI: <strong className="text-[var(--green)]">{Math.round(activeModule.metrics.maintainabilityIndex)}</strong></span>
                <span>Ca/Ce: <strong className="text-[var(--cyan)]">{activeModule.metrics.ca}/{activeModule.metrics.ce}</strong></span>
                <span>CC Max: <strong className="text-[var(--purple)]">{activeModule.metrics.cyclomaticComplexityMax}</strong></span>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] border border-[var(--border-soft)] text-[10px] font-medium transition"
                title={viewMode === 'source' ? 'Copiar código fuente al portapapeles' : 'Copiar contenido AST al portapapeles'}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--green)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--muted)]" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={() => {
                  setC4Level(3, null, activeModule.id, `Módulo: ${activeModule.name}`);
                  setActiveMainTab('c4');
                }}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--purple-soft)] hover:bg-[var(--purple)] hover:text-white text-[var(--purple)] border border-[var(--purple-border)] text-[10px] font-semibold transition"
                title="Ver en canvas C4"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Canvas</span>
              </button>
            </div>
          </div>
        )}

        {/* Code Lines View Area */}
        <div ref={codeScrollRef} className="flex-1 overflow-auto bg-[var(--bg)] font-mono text-[11.5px] p-4">
          {!activeModule ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted-2)]">
              <Code2 className="w-12 h-12 opacity-30 text-[var(--purple)] mb-2" />
              <p>Seleccione un módulo para visualizar su código.</p>
            </div>
          ) : viewMode === 'source' ? (
            !sourceEntry || sourceEntry.status === 'loading' ? (
              <div className="flex items-center justify-center h-full text-[var(--muted-2)] space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Leyendo archivo…</span>
              </div>
            ) : sourceEntry.status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 font-sans">
                <AlertTriangle className="w-8 h-8 text-[var(--yellow)] opacity-70" />
                <p className="text-[var(--text)] max-w-md">{sourceEntry.message}</p>
                <div className="flex items-center space-x-2">
                  {!isDemo && (
                    <button
                      onClick={() => loadSource(activeModule.id, true)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] border border-[var(--border-soft)] text-[10px] transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reintentar</span>
                    </button>
                  )}
                  <button
                    onClick={() => setViewMode('ast')}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--purple-soft)] text-[var(--purple)] border border-[var(--purple-border)] text-[10px] transition"
                  >
                    <Braces className="w-3 h-3" />
                    <span>Ver estructura AST</span>
                  </button>
                </div>
              </div>
            ) : sourceEntry.source.sizeBytes > MAX_HIGHLIGHT_BYTES ? (
              <div className="select-text">
                {sourceLines.map((text, i) => (
                  <div
                    key={i}
                    data-line={i + 1}
                    className={`flex px-2 ${highlightedLine === i + 1 ? 'bg-[var(--purple-soft)]' : ''}`}
                  >
                    <span className="w-12 text-right text-[var(--muted-2)] select-none pr-4 shrink-0 opacity-50">
                      {i + 1}
                    </span>
                    <pre className="flex-1 whitespace-pre text-[var(--text)]">{text}</pre>
                  </div>
                ))}
              </div>
            ) : (
              <SyntaxHighlighter
                language={PRISM_LANGUAGE_BY_EXTENSION[sourceEntry.source.extension] ?? 'text'}
                style={theme === 'dark' ? oneDark : oneLight}
                showLineNumbers
                wrapLines
                lineProps={(lineNumber: number) =>
                  ({
                    'data-line': lineNumber,
                    style: {
                      display: 'block',
                      backgroundColor: lineNumber === highlightedLine ? 'var(--purple-soft)' : undefined,
                    },
                  }) as React.HTMLProps<HTMLElement>
                }
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  fontSize: '11.5px',
                  userSelect: 'text',
                }}
                lineNumberStyle={{ minWidth: '3em', opacity: 0.45 }}
              >
                {sourceEntry.source.content}
              </SyntaxHighlighter>
            )
          ) : (
            <div className="space-y-0.5 select-text">
              {generatedCodeLines.map((line) => {
                let colorClass = 'text-[var(--text)]';
                if (line.type === 'comment') colorClass = 'text-[var(--muted-2)] italic';
                else if (line.type === 'import') colorClass = 'text-[var(--cyan)] font-semibold';
                else if (line.type === 'class') colorClass = 'text-[var(--purple)] font-bold';
                else if (line.type === 'function' || line.type === 'method') colorClass = 'text-[var(--green)] font-semibold';

                return (
                  <div
                    key={line.num}
                    className="flex items-start hover:bg-[var(--panel-2)]/60 px-2 py-0.5 rounded transition group"
                  >
                    <span className="w-10 text-right text-[var(--muted-2)] select-none pr-4 shrink-0 font-mono opacity-50 group-hover:opacity-100">
                      {line.num}
                    </span>
                    <pre className={`flex-1 overflow-x-auto ${colorClass} whitespace-pre`}>
                      {line.text}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Right AST Outline & Structure Panel */}
      {activeModule && (
        <aside className="w-[240px] bg-[var(--panel)] border-l border-[var(--border)] flex flex-col shrink-0">
          {/* Header */}
          <div className="p-3 border-b border-[var(--border)] bg-[var(--panel-2)] flex items-center justify-between">
            <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Estructura AST (Outline)
            </span>
            <span className="text-[9px] font-mono text-[var(--muted-2)]">
              {activeModule.classes.length} C | {activeModule.functions.length} F
            </span>
          </div>

          {/* Section Selector */}
          <div className="p-1.5 border-b border-[var(--border)] flex items-center justify-around text-[10px] font-mono bg-[var(--panel-3)]">
            <button
              onClick={() => setActiveOutlineSection('all')}
              className={`px-2 py-0.5 rounded ${activeOutlineSection === 'all' ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-bold' : 'text-[var(--muted)]'}`}
            >
              Todo
            </button>
            <button
              onClick={() => setActiveOutlineSection('classes')}
              className={`px-2 py-0.5 rounded ${activeOutlineSection === 'classes' ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-bold' : 'text-[var(--muted)]'}`}
            >
              Clases ({activeModule.classes.length})
            </button>
            <button
              onClick={() => setActiveOutlineSection('functions')}
              className={`px-2 py-0.5 rounded ${activeOutlineSection === 'functions' ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-bold' : 'text-[var(--muted)]'}`}
            >
              Func ({activeModule.functions.length})
            </button>
          </div>

          {/* Outline Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {/* Classes */}
            {(activeOutlineSection === 'all' || activeOutlineSection === 'classes') &&
              activeModule.classes.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-[var(--purple)] uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <Box className="w-3 h-3" />
                    <span>Clases e Interfaces</span>
                  </div>

                  <div className="space-y-1">
                    {activeModule.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="p-1.5 rounded bg-[var(--panel-2)] border border-[var(--border-soft)] space-y-1"
                      >
                        <div
                          onClick={() => jumpToDeclaration(cls.name)}
                          className="font-bold text-[var(--text)] text-[11px] flex items-center justify-between cursor-pointer hover:text-[var(--purple)]"
                        >
                          <span>{cls.name}</span>
                          <span className="text-[8px] font-mono text-[var(--muted-2)]">
                            {cls.methods.length} métodos
                          </span>
                        </div>

                        {/* Class Methods */}
                        {cls.methods.length > 0 && (
                          <div className="pl-2 space-y-0.5 border-l border-[var(--border)] pt-0.5">
                            {cls.methods.map((m) => (
                              <div
                                key={m.name}
                                onClick={() => jumpToDeclaration(m.name, cls.name)}
                                className="text-[10px] font-mono text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-between cursor-pointer"
                              >
                                <span className="truncate">{m.name}()</span>
                                <span className="text-[8px] text-[var(--purple)] font-bold">
                                  CC:{m.cyclomaticComplexity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Standalone Functions */}
            {(activeOutlineSection === 'all' || activeOutlineSection === 'functions') &&
              activeModule.functions.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-[var(--green)] uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <Braces className="w-3 h-3" />
                    <span>Funciones Exportadas</span>
                  </div>

                  <div className="space-y-1">
                    {activeModule.functions.map((fn) => (
                      <div
                        key={fn.id}
                        onClick={() => jumpToDeclaration(fn.name)}
                        className="p-1.5 rounded bg-[var(--panel-2)] border border-[var(--border-soft)] flex items-center justify-between cursor-pointer hover:border-[var(--green)]/40"
                      >
                        <div className="truncate">
                          <div className="font-semibold text-[var(--text)] text-[10.5px]">
                            {fn.name}()
                          </div>
                          <div className="text-[8.5px] font-mono text-[var(--muted-2)]">
                            LOC: {fn.loc}
                          </div>
                        </div>

                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[var(--green)]/10 text-[var(--green)] font-bold border border-[var(--green)]/20">
                          CC:{fn.cyclomaticComplexity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Imports */}
            {(activeOutlineSection === 'all' || activeOutlineSection === 'imports') &&
              activeModule.imports.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-[var(--cyan)] uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Importaciones ({activeModule.imports.length})</span>
                  </div>

                  <div className="space-y-0.5">
                    {activeModule.imports.map((imp) => (
                      <div
                        key={imp}
                        className="p-1 rounded bg-[var(--panel-2)] text-[9.5px] font-mono text-[var(--muted)] truncate hover:text-[var(--text)]"
                        title={imp}
                      >
                        {imp}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </aside>
      )}
    </div>
  );
};
