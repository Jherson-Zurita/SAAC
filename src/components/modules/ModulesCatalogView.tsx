import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Filter,
  ArrowUpDown,
  FileCode,
  Layers,
  Code2,
  Grid,
  List,
} from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useUiStore } from '../../stores/useUiStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { getModuleGroupColor } from '../../lib/color-utils';
import type { Module } from '../../../shared/types';

export const ModulesCatalogView: React.FC = () => {
  const { amg } = useProjectStore();
  const { selectElement } = useSelectionStore();
  const { setActiveMainTab } = useUiStore();
  const { setC4Level } = useDiagramStore();

  const [search, setSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'loc' | 'mi' | 'ce'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const modules = amg?.modules || [];

  // Extraer lenguajes y tipos únicos para filtros
  const languages = useMemo(() => {
    const set = new Set(modules.map((m) => m.language));
    return Array.from(set);
  }, [modules]);

  const moduleTypes = useMemo(() => {
    const set = new Set(modules.map((m) => m.moduleType));
    return Array.from(set);
  }, [modules]);

  // Filtrado y ordenamiento de módulos
  const filteredModules = useMemo(() => {
    return modules
      .filter((m) => {
        const matchesSearch =
          !search ||
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.id.toLowerCase().includes(search.toLowerCase());
        const matchesLang = selectedLanguage === 'all' || m.language === selectedLanguage;
        const matchesType = selectedType === 'all' || m.moduleType === selectedType;
        return matchesSearch && matchesLang && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'loc') return b.loc - a.loc;
        if (sortBy === 'mi') return b.metrics.maintainabilityIndex - a.metrics.maintainabilityIndex;
        if (sortBy === 'ce') return b.metrics.ce - a.metrics.ce;
        return 0;
      });
  }, [modules, search, selectedLanguage, selectedType, sortBy]);

  const handleOpenCode = (mod: Module) => {
    selectElement(mod.id, 'module', mod);
    setActiveMainTab('code');
  };

  const handleOpenDiagram = (mod: Module) => {
    selectElement(mod.id, 'module', mod);
    setC4Level(3, null, mod.id, `Módulo: ${mod.name}`);
    setActiveMainTab('c4');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--diagram-canvas)] p-4 overflow-hidden font-sans text-xs select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--purple-soft)] border border-[var(--purple-border)] flex items-center justify-center text-[var(--purple)] shadow-sm">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-[var(--text)] tracking-tight">
                Catálogo Directivo de Módulos
              </h2>
              <span className="px-2 py-0.5 rounded bg-[var(--purple-soft)] text-[var(--purple)] border border-[var(--purple-border)] text-[10px] font-mono font-bold">
                {modules.length} Módulos Registrados
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Directorio general del software con código de color dinámico por grupo, análisis de acoplamiento y accesos directos al IDE y Canvas.
            </p>
          </div>
        </div>

        {/* Controles de vista */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[var(--panel-2)] p-0.5 rounded border border-[var(--border-soft)]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${
                viewMode === 'grid'
                  ? 'bg-[var(--purple-soft)] text-[var(--purple)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Vista en Cuadrícula"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition ${
                viewMode === 'list'
                  ? 'bg-[var(--purple-soft)] text-[var(--purple)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title="Vista en Lista Detallada"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-[var(--panel)] p-2.5 rounded-lg border border-[var(--border)]">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
          <input
            type="text"
            placeholder="Buscar módulo por nombre o ruta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--panel-2)] text-[var(--text)] text-[11px] pl-8 pr-3 py-1.5 rounded border border-[var(--border-soft)] focus:outline-none focus:border-[var(--purple)] font-sans placeholder:text-[var(--muted-2)]"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center space-x-2">
          {/* Lenguaje */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3 h-3 text-[var(--muted-2)]" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-[var(--panel-2)] text-[var(--text)] text-[11px] px-2 py-1.5 rounded border border-[var(--border-soft)] focus:outline-none focus:border-[var(--purple)] font-mono"
            >
              <option value="all">Todos los Lenguajes</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Módulo */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[var(--panel-2)] text-[var(--text)] text-[11px] px-2 py-1.5 rounded border border-[var(--border-soft)] focus:outline-none focus:border-[var(--purple)] font-mono"
          >
            <option value="all">Todos los Tipos</option>
            {moduleTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Ordenamiento */}
          <div className="flex items-center space-x-1 pl-2 border-l border-[var(--border)]">
            <ArrowUpDown className="w-3 h-3 text-[var(--muted-2)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[var(--panel-2)] text-[var(--text)] text-[11px] px-2 py-1.5 rounded border border-[var(--border-soft)] focus:outline-none focus:border-[var(--purple)] font-mono"
            >
              <option value="name">Ordenar por Nombre</option>
              <option value="loc">Ordenar por LOC (Mayor)</option>
              <option value="mi">Ordenar por Mantenibilidad (MI)</option>
              <option value="ce">Ordenar por Acoplamiento (Ce)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid or List Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--muted-2)] space-y-2">
            <Boxes className="w-10 h-10 opacity-30 text-[var(--purple)]" />
            <p className="font-semibold text-[var(--muted)]">No se encontraron módulos</p>
            <p className="text-[11px]">Intente cambiar los filtros o el término de búsqueda.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredModules.map((mod) => {
              const color = getModuleGroupColor(mod.id);
              const mi = Math.round(mod.metrics.maintainabilityIndex);
              const miColor =
                mi >= 80 ? 'var(--green)' : mi >= 60 ? 'var(--yellow)' : 'var(--red)';

              return (
                <div
                  key={mod.id}
                  className="group bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--purple)]/60 rounded-lg p-3 flex flex-col justify-between transition shadow-sm hover:shadow-md relative overflow-hidden"
                  style={{ borderLeftWidth: '4px', borderLeftColor: color.hex }}
                >
                  <div>
                    {/* Top Bar: Name & Group Badge */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-1.5 truncate">
                        <FileCode className="w-4 h-4 shrink-0" style={{ color: color.hex }} />
                        <h3 className="font-bold text-[12px] text-[var(--text)] truncate group-hover:text-[var(--purple)] transition">
                          {mod.name}
                        </h3>
                      </div>

                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0"
                        style={{
                          color: color.hex,
                          backgroundColor: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        {mod.language}
                      </span>
                    </div>

                    {/* Path */}
                    <p className="text-[9.5px] font-mono text-[var(--muted-2)] truncate mb-2.5" title={mod.id}>
                      {mod.id}
                    </p>

                    {/* Metric Chips */}
                    <div className="grid grid-cols-4 gap-1 mb-3 text-[9.5px] font-mono">
                      <div className="bg-[var(--panel-2)] p-1 rounded border border-[var(--border-soft)] text-center">
                        <span className="block text-[8px] text-[var(--muted-2)] uppercase">LOC</span>
                        <span className="font-bold text-[var(--text)]">{mod.loc}</span>
                      </div>

                      <div className="bg-[var(--panel-2)] p-1 rounded border border-[var(--border-soft)] text-center">
                        <span className="block text-[8px] text-[var(--muted-2)] uppercase">MI</span>
                        <span className="font-bold" style={{ color: miColor }}>
                          {mi}
                        </span>
                      </div>

                      <div className="bg-[var(--panel-2)] p-1 rounded border border-[var(--border-soft)] text-center">
                        <span className="block text-[8px] text-[var(--muted-2)] uppercase">Ca / Ce</span>
                        <span className="font-bold text-[var(--cyan)]">
                          {mod.metrics.ca}/{mod.metrics.ce}
                        </span>
                      </div>

                      <div className="bg-[var(--panel-2)] p-1 rounded border border-[var(--border-soft)] text-center">
                        <span className="block text-[8px] text-[var(--muted-2)] uppercase">CC Máx</span>
                        <span className="font-bold text-[var(--purple)]">
                          {mod.metrics.cyclomaticComplexityMax}
                        </span>
                      </div>
                    </div>

                    {/* Code Details */}
                    <div className="flex items-center space-x-3 text-[10px] text-[var(--muted)] mb-3 pt-1 border-t border-[var(--border-soft)] font-mono">
                      <span>Clases: <strong className="text-[var(--text)]">{mod.classes.length}</strong></span>
                      <span>Funciones: <strong className="text-[var(--text)]">{mod.functions.length}</strong></span>
                      <span>Imports: <strong className="text-[var(--text)]">{mod.imports.length}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={() => handleOpenCode(mod)}
                      className="flex-1 flex items-center justify-center space-x-1 py-1 px-2 rounded bg-[var(--purple-soft)] hover:bg-[var(--purple)] hover:text-white text-[var(--purple)] border border-[var(--purple-border)] text-[10px] font-semibold transition"
                      title="Visualizar código en el IDE integrador"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Ver Código IDE</span>
                    </button>

                    <button
                      onClick={() => handleOpenDiagram(mod)}
                      className="flex-1 flex items-center justify-center space-x-1 py-1 px-2 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] border border-[var(--border-soft)] text-[10px] font-semibold transition"
                      title="Navegar al diagrama C4 de este módulo"
                    >
                      <Layers className="w-3 h-3 text-[var(--cyan)]" />
                      <span>Ver Diagrama</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--panel-2)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
                  <th className="p-2.5">Grupo / Módulo</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5">Lenguaje</th>
                  <th className="p-2.5 text-right">LOC</th>
                  <th className="p-2.5 text-right">MI (Mantenibilidad)</th>
                  <th className="p-2.5 text-right">Ca (Aferente)</th>
                  <th className="p-2.5 text-right">Ce (Eferente)</th>
                  <th className="p-2.5 text-right">CC Máx</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] font-mono text-[11px]">
                {filteredModules.map((mod) => {
                  const color = getModuleGroupColor(mod.id);
                  const mi = Math.round(mod.metrics.maintainabilityIndex);
                  const miColor =
                    mi >= 80 ? 'var(--green)' : mi >= 60 ? 'var(--yellow)' : 'var(--red)';

                  return (
                    <tr key={mod.id} className="hover:bg-[var(--panel-2)] transition">
                      <td className="p-2.5">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div>
                            <span className="font-bold text-[var(--text)] font-sans">{mod.name}</span>
                            <span className="block text-[9px] text-[var(--muted-2)] truncate max-w-xs">{mod.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--panel-3)] text-[var(--muted)] text-[9px]">
                          {mod.moduleType}
                        </span>
                      </td>

                      <td className="p-2.5 font-bold" style={{ color: color.hex }}>
                        {mod.language}
                      </td>

                      <td className="p-2.5 text-right font-bold">{mod.loc}</td>

                      <td className="p-2.5 text-right font-bold" style={{ color: miColor }}>
                        {mi}
                      </td>

                      <td className="p-2.5 text-right text-[var(--cyan)] font-bold">{mod.metrics.ca}</td>

                      <td className="p-2.5 text-right text-[var(--purple)] font-bold">{mod.metrics.ce}</td>

                      <td className="p-2.5 text-right font-bold">{mod.metrics.cyclomaticComplexityMax}</td>

                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenCode(mod)}
                            className="p-1.5 rounded bg-[var(--purple-soft)] text-[var(--purple)] hover:bg-[var(--purple)] hover:text-white transition"
                            title="Abrir en IDE"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenDiagram(mod)}
                            className="p-1.5 rounded bg-[var(--panel-3)] text-[var(--cyan)] hover:bg-[var(--cyan)] hover:text-white transition"
                            title="Ver Diagrama"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
