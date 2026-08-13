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
  {
    tab: 'coupling-heatmap',
    backendKey: 'supplementary:coupling-heatmap',
    title: 'Mapa de Calor de Acoplamiento',
    shortLabel: 'Matriz Acoplamiento',
    direction: 'LR',
  },
  {
    tab: 'deployment',
    backendKey: 'supplementary:deployment-diagram',
    title: 'Diagrama de Despliegue',
    shortLabel: 'Despliegue',
    direction: 'TB',
  },
  {
    tab: 'filetree',
    backendKey: 'supplementary:file-tree',
    title: 'Árbol de Directorios (Grafo Horizontal)',
    shortLabel: 'Árbol de carpetas',
    direction: 'LR',
  },
  {
    tab: 'treemap',
    backendKey: 'supplementary:treemap',
    title: 'Mapa de Carpetas (Treemap)',
    shortLabel: 'Treemap D3',
    direction: 'LR',
  },
  {
    tab: 'ownership',
    backendKey: 'supplementary:ownership-map',
    title: 'Mapa de Contribuciones (Ownership)',
    shortLabel: 'Ownership',
    direction: 'LR',
  },
  {
    tab: 'landscape',
    backendKey: 'supplementary:system-landscape',
    title: 'Paisaje del Sistema (System Landscape)',
    shortLabel: 'Landscape',
    direction: 'LR',
  },
  {
    tab: 'timeline',
    backendKey: 'supplementary:timeline',
    title: 'Evolución Arquitectónica',
    shortLabel: 'Timeline',
    direction: 'LR',
  },
  {
    tab: 'force-graph',
    backendKey: 'supplementary:force-graph',
    title: 'Grafo de Dependencias (Nodos Proporcionales)',
    shortLabel: 'Grafo de Fuerza',
    direction: 'LR',
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
