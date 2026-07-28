import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { SupplementaryDiagramView } from './SupplementaryDiagramView';

export const ErDiagramView: React.FC<{ diagramData: C4DiagramData }> = ({ diagramData }) => (
  <SupplementaryDiagramView tab="er" diagramData={diagramData} />
);
