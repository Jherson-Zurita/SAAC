/**
 * Utilidades para generación determinista de paleta de colores por hash de módulo/cadena.
 * Asigna un color único, vibrante y accesible a cada nombre de módulo para diferenciarlos
 * visualmente en diagramas, catálogo y visor de código.
 */

const PALETTE = [
  { hex: '#8B7CFF', hsl: 'hsl(246, 100%, 74%)', bg: 'rgba(139, 124, 255, 0.15)', border: 'rgba(139, 124, 255, 0.4)' }, // Morado
  { hex: '#45C8DF', hsl: 'hsl(189, 73%, 57%)', bg: 'rgba(69, 200, 223, 0.15)', border: 'rgba(69, 200, 223, 0.4)' },  // Cyan
  { hex: '#4FD49A', hsl: 'hsl(154, 61%, 57%)', bg: 'rgba(79, 212, 154, 0.15)', border: 'rgba(79, 212, 154, 0.4)' },  // Esmeralda
  { hex: '#E7B85B', hsl: 'hsl(40, 75%, 63%)', bg: 'rgba(231, 184, 91, 0.15)', border: 'rgba(231, 184, 91, 0.4)' },   // Ámbar
  { hex: '#EF6B73', hsl: 'hsl(356, 80%, 68%)', bg: 'rgba(239, 107, 115, 0.15)', border: 'rgba(239, 107, 115, 0.4)' }, // Rosa/Rojo
  { hex: '#EF925C', hsl: 'hsl(22, 82%, 65%)', bg: 'rgba(239, 146, 92, 0.15)', border: 'rgba(239, 146, 92, 0.4)' },   // Naranja
  { hex: '#3B82F6', hsl: 'hsl(217, 91%, 60%)', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' },  // Azul
  { hex: '#EC4899', hsl: 'hsl(330, 81%, 60%)', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)' },  // Fucsia
  { hex: '#10B981', hsl: 'hsl(160, 84%, 39%)', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' },  // Verde Menta
  { hex: '#A855F7', hsl: 'hsl(271, 91%, 65%)', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)' },  // Púrpura Intenso
  { hex: '#06B6D4', hsl: 'hsl(188, 86%, 53%)', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' },   // Azul Turquesa
  { hex: '#F59E0B', hsl: 'hsl(38, 92%, 50%)', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' },   // Amarillo Cálido
];

/**
 * Retorna un objeto de color determinista basado en el nombre del módulo o grupo.
 */
export function getModuleGroupColor(str?: string | null) {
  if (!str) return PALETTE[0];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
