import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { SupplementaryDiagramView } from './SupplementaryDiagramView';

export const SequenceDiagramView: React.FC<{ diagramData: C4DiagramData }> = ({ diagramData }) => (
  <SupplementaryDiagramView tab="sequence" diagramData={diagramData} />
);
