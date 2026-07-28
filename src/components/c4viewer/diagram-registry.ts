import type { MainTab, SupplementaryDiagramTab } from '../../stores/useUiStore';

export interface SupplementaryDiagramDefinition {
  tab: SupplementaryDiagramTab;
  backendKey: `supplementary:${string}`;
  title: string;
  shortLabel: string;
  direction: 'LR' | 'TB';
}

export const supplementaryDiagramDefinitions = [
  {
    tab: 'circular',
    backendKey: 'supplementary:circular-dependencies',
    title: 'Módulos Circulares',
    shortLabel: 'Módulos circulares',
    direction: 'LR',
  },
  {
    tab: 'package',
    backendKey: 'supplementary:package-diagram',
    title: 'Diagrama de Paquetes',
    shortLabel: 'Paquetes',
    direction: 'LR',
  },
  {
    tab: 'inheritance',
    backendKey: 'supplementary:inheritance-tree',
    title: 'Árbol de Herencia',
    shortLabel: 'Herencia',
    direction: 'TB',
  },
  {
    tab: 'er',
    backendKey: 'supplementary:er-diagram',
    title: 'Diagrama Entidad-Relación',
    shortLabel: 'Entidad-relación',
    direction: 'LR',
  },
  {
    tab: 'callgraph',
    backendKey: 'supplementary:call-graph',
    title: 'Grafo de Llamadas',
    shortLabel: 'Call graph',
    direction: 'LR',
  },
  {
    tab: 'sequence',
    backendKey: 'supplementary:sequence-diagram',
    title: 'Diagrama de Secuencia',
    shortLabel: 'Secuencia',
    direction: 'LR',
  },
  {
    tab: 'dynamic',
    backendKey: 'supplementary:dynamic-diagram',
    title: 'Diagrama Dinámico C4',
    shortLabel: 'Dinámico',
    direction: 'LR',
  },
  {
    tab: 'dfd',
    backendKey: 'supplementary:dfd-diagram',
    title: 'Diagrama de Flujo de Datos',
    shortLabel: 'Flujo de datos',
    direction: 'TB',
  },
] as const satisfies readonly SupplementaryDiagramDefinition[];

const supplementaryTabs = new Set<MainTab>(
  supplementaryDiagramDefinitions.map((definition) => definition.tab)
);

export function isSupplementaryDiagramTab(tab: MainTab): tab is SupplementaryDiagramTab {
  return supplementaryTabs.has(tab);
}

export function isDiagramTab(tab: MainTab): boolean {
  return tab === 'c4' || isSupplementaryDiagramTab(tab);
}

export function getSupplementaryDiagramDefinition(
  tab: SupplementaryDiagramTab
): SupplementaryDiagramDefinition {
  const definition = supplementaryDiagramDefinitions.find((item) => item.tab === tab);
  if (!definition) {
    throw new Error(`No existe configuración para el diagrama "${tab}"`);
  }
  return definition;
}
