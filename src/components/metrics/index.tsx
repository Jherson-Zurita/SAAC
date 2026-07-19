import React from 'react';

export const MetricsPanel: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Métricas Arquitectónicas</h1>
      <p className="mt-2 text-gray-600">Complejidad, acoplamiento, cohesión y distancia a la secuencia principal.</p>
    </div>
  );
};
