import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import type { SupplementaryDiagramTab } from '../../stores/useUiStore';
import { C4Canvas } from '../c4viewer/C4Canvas';
import { getSupplementaryDiagramDefinition } from '../c4viewer/diagram-registry';

interface SupplementaryDiagramViewProps {
  tab: SupplementaryDiagramTab;
  diagramData: C4DiagramData;
}

export const SupplementaryDiagramView: React.FC<SupplementaryDiagramViewProps> = ({
  tab,
  diagramData,
}) => {
  const definition = getSupplementaryDiagramDefinition(tab);

  return (
    <C4Canvas
      diagramData={diagramData}
      title={definition.title}
      direction={definition.direction}
    />
  );
};
