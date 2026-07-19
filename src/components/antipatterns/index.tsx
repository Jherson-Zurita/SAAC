import React from 'react';

export const AntipatternsPanel: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Antipatrones Arquitectónicos</h1>
      <p className="mt-2 text-gray-600">Ciclos de dependencias, God Modules y violación de reglas de arquitectura.</p>
    </div>
  );
};
