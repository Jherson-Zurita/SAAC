import React from 'react';
import type { ProjectMetrics } from '../../../shared/types';

interface MetricsRadarChartProps {
  metrics: ProjectMetrics;
  fitnessScore?: number;
}

export const MetricsRadarChart: React.FC<MetricsRadarChartProps> = ({
  metrics,
  fitnessScore = 80,
}) => {
  // Dimensiones normalizadas [0, 100]
  const dimensions = [
    {
      label: 'Mantenibilidad (MI)',
      value: Math.min(100, Math.max(0, metrics.maintainabilityIndexAvg || 0)),
    },
    {
      label: 'Simplicidad (1/CC)',
      value: Math.min(100, Math.max(0, 100 - (metrics.avgCyclomaticComplexity || 1) * 8)),
    },
    {
      label: 'Estabilidad (1-I)',
      value: Math.min(100, Math.max(0, (1 - (metrics.avgInstability || 0)) * 100)),
    },
    {
      label: 'Abstracción (A)',
      value: Math.min(100, Math.max(0, (metrics.avgAbstractness || 0) * 100)),
    },
    {
      label: 'Secuencia Princ. (1-D)',
      value: Math.min(100, Math.max(0, (1 - (metrics.avgDistance || 0)) * 100)),
    },
    {
      label: 'Fitness Score',
      value: Math.min(100, Math.max(0, fitnessScore)),
    },
  ];

  const size = 300;
  const center = size / 2;
  const radius = center - 50;
  const total = dimensions.length;

  // Calcular puntos (x, y) en el radar
  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2;
    const r = (val / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Crear cadena polygon string
  const polygonPoints = dimensions
    .map((d, i) => {
      const { x, y } = getCoordinates(i, d.value);
      return `${x},${y}`;
    })
    .join(' ');

  // Grid celdas concéntricas (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 shadow-lg select-none flex flex-col items-center justify-center">
      <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-2 self-start">
        Perfil de Salud Arquitectónica
      </h3>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Círculos concéntricos de nivel */}
          {levels.map((level, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius * level}
              fill="none"
              stroke="var(--border)"
              strokeDasharray={idx === levels.length - 1 ? 'none' : '3,3'}
              strokeWidth="1"
            />
          ))}

          {/* Ejes radiales */}
          {dimensions.map((_, i) => {
            const { x, y } = getCoordinates(i, 100);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
            );
          })}

          {/* Polígono de datos radar */}
          <polygon
            points={polygonPoints}
            fill="rgba(6, 182, 212, 0.25)"
            stroke="var(--cyan)"
            strokeWidth="2"
            className="transition-all duration-500 hover:fill-[var(--cyan)]/35"
          />

          {/* Puntos y etiquetas de los vértices */}
          {dimensions.map((d, i) => {
            const { x, y } = getCoordinates(i, d.value);
            const labelCoords = getCoordinates(i, 118);

            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="var(--cyan)" stroke="var(--panel)" strokeWidth="1.5" />
                <text
                  x={labelCoords.x}
                  y={labelCoords.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-[var(--text)] text-[10px] font-semibold font-mono"
                >
                  {d.label.split(' ')[0]} ({Math.round(d.value)})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
