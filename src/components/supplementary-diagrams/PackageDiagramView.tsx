import React from 'react';
import type { C4DiagramData } from '../../../shared/types';
import { SupplementaryDiagramView } from './SupplementaryDiagramView';

export const PackageDiagramView: React.FC<{ diagramData: C4DiagramData }> = ({ diagramData }) => (
  <SupplementaryDiagramView tab="package" diagramData={diagramData} />
);
