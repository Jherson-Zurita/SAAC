import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import {
  BarChart3,
  Search,
  Download,
  ArrowUpDown,
  FileCode,
  Box,
  Code2,
} from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { Module, ClassInfo, FunctionInfo } from '../../../shared/types';

export const MetricsPanel: React.FC = () => {
  const { amg } = useProjectStore();
  const { selectElement } = useSelectionStore();

  const [activeTab, setActiveTab] = useState<'modules' | 'classes' | 'functions'>('modules');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterThreshold, setFilterThreshold] = useState<'all' | 'critical_mi' | 'high_instability' | 'high_cc'>('all');

  // Datos compilados de Módulos, Clases y Funciones
  const modulesData = useMemo(() => amg?.modules || [], [amg]);

  const classesData = useMemo(() => {
    if (!amg) return [];
    const list: Array<{ classInfo: ClassInfo; moduleName: string; moduleId: string }> = [];
    amg.modules.forEach((mod) => {
      mod.classes.forEach((cls) => {
        list.push({ classInfo: cls, moduleName: mod.name, moduleId: mod.id });
      });
    });
    return list;
  }, [amg]);

  const functionsData = useMemo(() => {
    if (!amg) return [];
    const list: Array<{ funcInfo: FunctionInfo; moduleName: string; moduleId: string }> = [];
    amg.modules.forEach((mod) => {
      mod.functions.forEach((fn) => {
        list.push({ funcInfo: fn, moduleName: mod.name, moduleId: mod.id });
      });
    });
    return list;
  }, [amg]);

  // Filtrado por umbral para módulos
  const filteredModulesData = useMemo(() => {
    if (filterThreshold === 'critical_mi') {
      return modulesData.filter((m) => m.metrics.maintainabilityIndex < 60);
    }
    if (filterThreshold === 'high_instability') {
      return modulesData.filter((m) => m.metrics.instability > 0.8);
    }
    if (filterThreshold === 'high_cc') {
      return modulesData.filter((m) => m.metrics.cyclomaticComplexityAvg > 10);
    }
    return modulesData;
  }, [modulesData, filterThreshold]);

  // Columnas para Módulos
  const moduleColumnHelper = createColumnHelper<Module>();
  const moduleColumns = useMemo(
    () => [
      moduleColumnHelper.accessor('name', {
        header: 'Módulo',
        cell: (info) => (
          <div className="font-bold text-[var(--cyan)] flex items-center space-x-1.5">
            <FileCode className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" />
            <span className="truncate">{info.getValue()}</span>
          </div>
        ),
      }),
      moduleColumnHelper.accessor('language', {
        header: 'Lenguaje',
        cell: (info) => (
          <span className="text-[10px] font-mono uppercase bg-[var(--panel-2)] px-1.5 py-0.5 rounded text-[var(--muted)] border border-[var(--border-soft)]">
            {info.getValue()}
          </span>
        ),
      }),
      moduleColumnHelper.accessor('loc', {
        header: 'LOC',
        cell: (info) => <span className="font-mono text-[var(--text)]">{info.getValue()}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.ca, {
        id: 'ca',
        header: 'Ca',
        cell: (info) => <span className="font-mono text-[var(--cyan)]">{info.getValue()}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.ce, {
        id: 'ce',
        header: 'Ce',
        cell: (info) => <span className="font-mono text-[var(--purple)]">{info.getValue()}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.instability, {
        id: 'instability',
        header: 'Instabilidad (I)',
        cell: (info) => <span className="font-mono text-[var(--yellow)]">{info.getValue().toFixed(2)}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.abstractness, {
        id: 'abstractness',
        header: 'Abstracción (A)',
        cell: (info) => <span className="font-mono text-[var(--cyan)]">{info.getValue().toFixed(2)}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.distance, {
        id: 'distance',
        header: 'Distancia (D)',
        cell: (info) => <span className="font-mono text-[var(--red)]">{info.getValue().toFixed(2)}</span>,
      }),
      moduleColumnHelper.accessor((row) => row.metrics.maintainabilityIndex, {
        id: 'mi',
        header: 'MI (Mantenibilidad)',
        cell: (info) => {
          const val = Math.round(info.getValue());
          const colorClass =
            val >= 80 ? 'text-[var(--green)] font-bold' : val >= 60 ? 'text-[var(--yellow)] font-bold' : 'text-[var(--red)] font-extrabold';
          return <span className={`font-mono ${colorClass}`}>{val} / 100</span>;
        },
      }),
    ],
    [moduleColumnHelper]
  );

  const table = useReactTable({
    data: filteredModulesData,
    columns: moduleColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Exportar datos a CSV o JSON
  const exportData = (format: 'json' | 'csv') => {
    if (!amg) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(amg.metrics, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${amg.projectName}_metrics.json`;
      a.click();
    } else {
      const headers = ['Nombre', 'Lenguaje', 'LOC', 'Ca', 'Ce', 'Instabilidad', 'Abstractness', 'Distancia', 'MI'];
      const rows = amg.modules.map((m) => [
        m.name,
        m.language,
        m.loc,
        m.metrics.ca,
        m.metrics.ce,
        m.metrics.instability.toFixed(2),
        m.metrics.abstractness.toFixed(2),
        m.metrics.distance.toFixed(2),
        Math.round(m.metrics.maintainabilityIndex),
      ]);

      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${amg.projectName}_metrics.csv`;
      a.click();
    }
  };

  if (!amg) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--muted)]">
        <BarChart3 className="w-12 h-12 text-[var(--purple)]/40 mb-2" />
        <p className="font-semibold text-sm text-[var(--text)]">Sin datos de métricas.</p>
        <p className="text-xs text-[var(--muted)]">Analice un proyecto para consultar la tabla de métricas.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200 overflow-hidden p-5 space-y-4 select-none font-sans">
      {/* Bar superior de Controles & Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--panel)] p-3 rounded-xl border border-[var(--border)]">
        {/* Pestañas de Nivel (Módulos / Clases / Funciones) */}
        <div className="flex items-center space-x-1 bg-[var(--bg)] p-1 rounded-lg border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 ${
              activeTab === 'modules' ? 'bg-[var(--purple)] text-white' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Módulos ({amg.modules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 ${
              activeTab === 'classes' ? 'bg-[var(--purple)] text-white' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Clases ({classesData.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('functions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 ${
              activeTab === 'functions' ? 'bg-[var(--purple)] text-white' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Funciones ({functionsData.length})</span>
          </button>
        </div>

        {/* Filtro Rápido por Umbral */}
        {activeTab === 'modules' && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFilterThreshold(filterThreshold === 'critical_mi' ? 'all' : 'critical_mi')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition ${
                filterThreshold === 'critical_mi'
                  ? 'bg-[var(--red)]/20 text-[var(--red)] border-[var(--red)]/40'
                  : 'bg-[var(--panel-2)] text-[var(--muted)] border-[var(--border-soft)] hover:text-[var(--text)]'
              }`}
            >
              ⚠️ MI &lt; 60
            </button>
            <button
              onClick={() => setFilterThreshold(filterThreshold === 'high_instability' ? 'all' : 'high_instability')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition ${
                filterThreshold === 'high_instability'
                  ? 'bg-[var(--yellow)]/20 text-[var(--yellow)] border-[var(--yellow)]/40'
                  : 'bg-[var(--panel-2)] text-[var(--muted)] border-[var(--border-soft)] hover:text-[var(--text)]'
              }`}
            >
              ⚡ Inestables (I &gt; 0.8)
            </button>
          </div>
        )}

        {/* Input Búsqueda y Botones Exportar */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
            <input
              type="text"
              placeholder="Buscar métrica..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full bg-[var(--bg)] text-xs text-[var(--text)] pl-8 pr-2 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--cyan)] placeholder:text-[var(--muted-2)]"
            />
          </div>

          <button
            onClick={() => exportData('csv')}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] text-xs font-semibold rounded-lg border border-[var(--border-soft)] transition"
            title="Exportar métricas a CSV"
          >
            <Download className="w-3.5 h-3.5 text-[var(--cyan)]" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => exportData('json')}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-[var(--panel-2)] hover:bg-[var(--panel-3)] text-[var(--text)] text-xs font-semibold rounded-lg border border-[var(--border-soft)] transition"
            title="Exportar métricas a JSON"
          >
            <Download className="w-3.5 h-3.5 text-[var(--purple)]" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Tabla Principal TanStack Table */}
      <div className="flex-1 overflow-auto bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-lg">
        {activeTab === 'modules' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--muted)] font-semibold sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-2.5 cursor-pointer hover:text-[var(--text)] transition select-none"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-[var(--border-soft)]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => selectElement(row.original.id, 'module', row.original)}
                  className="hover:bg-[var(--panel-2)] cursor-pointer transition"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pestaña Clases */}
        {activeTab === 'classes' && (
          <div className="p-4 space-y-2">
            {classesData.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[var(--panel-2)] border border-[var(--border-soft)] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[var(--cyan)]">{item.classInfo.name}</span>
                  <span className="text-[10px] text-[var(--muted)] ml-2">Módulo: {item.moduleName}</span>
                </div>
                <div className="flex items-center space-x-3 font-mono text-[var(--text)]">
                  <span>WMC: <strong className="text-[var(--yellow)]">{item.classInfo.metrics.wmc}</strong></span>
                  <span>DIT: {item.classInfo.metrics.dit}</span>
                  <span>CBO: {item.classInfo.metrics.cbo}</span>
                  <span>LCOM4: <strong className="text-[var(--red)]">{item.classInfo.metrics.lcom4}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pestaña Funciones */}
        {activeTab === 'functions' && (
          <div className="p-4 space-y-2">
            {functionsData.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[var(--panel-2)] border border-[var(--border-soft)] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[var(--purple)]">{item.funcInfo.name}()</span>
                  <span className="text-[10px] text-[var(--muted)] ml-2">Módulo: {item.moduleName}</span>
                </div>
                <div className="flex items-center space-x-3 font-mono text-[var(--text)]">
                  <span>LOC: {item.funcInfo.loc}</span>
                  <span>CC: <strong className="text-[var(--yellow)]">{item.funcInfo.cyclomaticComplexity}</strong></span>
                  <span>Cognitiva: <strong className="text-[var(--cyan)]">{item.funcInfo.cognitiveComplexity}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
