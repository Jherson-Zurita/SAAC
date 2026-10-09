import type { EdgeType, ProposedNodeType } from '../../../shared/types';
import type { DesignFragment } from './design-flow';

export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  fragment: DesignFragment;
}

type NodeSpec = [key: string, nodeType: ProposedNodeType, label: string, properties?: Record<string, unknown>];
type EdgeSpec = [source: string, target: string, edgeType: EdgeType, label?: string];

function fragment(nodes: NodeSpec[], edges: EdgeSpec[]): DesignFragment {
  return {
    nodes: nodes.map(([key, nodeType, label, properties = {}]) => ({
      key,
      nodeType,
      label,
      position: { x: 0, y: 0 },
      properties,
    })),
    edges: edges.map(([source, target, edgeType, label]) => ({
      source,
      target,
      edgeType,
      ...(label ? { label } : {}),
      properties: {},
    })),
  };
}

export const DESIGN_TEMPLATES: readonly DesignTemplate[] = [
  {
    id: 'layered',
    name: 'Arquitectura en capas',
    description: 'Presentación, negocio y acceso a datos con dependencias descendentes.',
    fragment: fragment(
      [
        ['user', 'actor', 'Usuario', { role: 'Usuario final' }],
        ['web', 'container', 'Aplicación web', { technology: 'SPA' }],
        ['presentation', 'module', 'Capa de presentación', { responsibility: 'Controladores, vistas y validación de entrada' }],
        ['business', 'module', 'Capa de negocio', { responsibility: 'Reglas y casos de uso del dominio' }],
        ['data', 'module', 'Capa de acceso a datos', { responsibility: 'Repositorios y mapeo objeto-relacional' }],
        ['db', 'external-system', 'Base de datos', { protocol: 'SQL' }],
      ],
      [
        ['user', 'web', 'invocation', 'Usa'],
        ['web', 'presentation', 'containment'],
        ['web', 'business', 'containment'],
        ['web', 'data', 'containment'],
        ['presentation', 'business', 'dependency'],
        ['business', 'data', 'dependency'],
        ['data', 'db', 'external-call', 'Lee y escribe'],
      ]
    ),
  },
  {
    id: 'hexagonal',
    name: 'Hexagonal (puertos y adaptadores)',
    description: 'Dominio aislado; los adaptadores implementan los puertos.',
    fragment: fragment(
      [
        ['client', 'actor', 'Cliente', { role: 'Consumidor de la API' }],
        ['rest', 'module', 'Adaptador REST', { responsibility: 'Traduce HTTP a casos de uso' }],
        ['in-ports', 'module', 'Puertos de entrada', { responsibility: 'Interfaces de casos de uso' }],
        ['domain', 'module', 'Dominio', { responsibility: 'Entidades y reglas de negocio puras' }],
        ['out-ports', 'module', 'Puertos de salida', { responsibility: 'Interfaces de persistencia y mensajería' }],
        ['persistence', 'module', 'Adaptador de persistencia', { responsibility: 'Implementa los repositorios' }],
        ['messaging', 'module', 'Adaptador de mensajería', { responsibility: 'Publica eventos de dominio' }],
        ['db', 'external-system', 'Base de datos', { protocol: 'SQL' }],
        ['broker', 'external-system', 'Broker de mensajes', { protocol: 'AMQP' }],
      ],
      [
        ['client', 'rest', 'invocation', 'HTTP'],
        ['rest', 'in-ports', 'dependency'],
        ['in-ports', 'domain', 'dependency'],
        ['domain', 'out-ports', 'dependency'],
        ['persistence', 'out-ports', 'inheritance', 'implementa'],
        ['messaging', 'out-ports', 'inheritance', 'implementa'],
        ['persistence', 'db', 'external-call'],
        ['messaging', 'broker', 'external-call'],
      ]
    ),
  },
  {
    id: 'microservices',
    name: 'Microservicios',
    description: 'API Gateway, servicios independientes y comunicación por eventos.',
    fragment: fragment(
      [
        ['user', 'actor', 'Usuario', { role: 'Usuario final' }],
        ['gateway', 'container', 'API Gateway', { technology: 'Reverse proxy' }],
        ['users', 'container', 'Servicio de usuarios', { technology: 'REST' }],
        ['orders', 'container', 'Servicio de pedidos', { technology: 'REST' }],
        ['payments', 'container', 'Servicio de pagos', { technology: 'REST' }],
        ['users-db', 'external-system', 'BD de usuarios', { protocol: 'SQL' }],
        ['orders-db', 'external-system', 'BD de pedidos', { protocol: 'SQL' }],
        ['broker', 'external-system', 'Bus de eventos', { protocol: 'Kafka' }],
        ['psp', 'external-system', 'Pasarela de pago', { protocol: 'HTTPS' }],
      ],
      [
        ['user', 'gateway', 'invocation', 'HTTPS'],
        ['gateway', 'users', 'invocation'],
        ['gateway', 'orders', 'invocation'],
        ['gateway', 'payments', 'invocation'],
        ['users', 'users-db', 'external-call'],
        ['orders', 'orders-db', 'external-call'],
        ['orders', 'broker', 'external-call', 'Publica PedidoCreado'],
        ['payments', 'broker', 'external-call', 'Consume eventos'],
        ['payments', 'psp', 'external-call', 'Cobros'],
      ]
    ),
  },
  {
    id: 'mvc',
    name: 'Cliente-servidor MVC',
    description: 'Cliente SPA y servidor con modelo, vista y controlador.',
    fragment: fragment(
      [
        ['user', 'actor', 'Usuario', { role: 'Usuario final' }],
        ['client', 'container', 'Cliente SPA', { technology: 'React' }],
        ['server', 'container', 'Servidor API', { technology: 'REST' }],
        ['view', 'module', 'Vista', { responsibility: 'Renderizado e interacción' }],
        ['controller', 'module', 'Controlador', { responsibility: 'Orquesta peticiones y respuestas' }],
        ['model', 'module', 'Modelo', { responsibility: 'Estado y reglas de negocio' }],
        ['db', 'external-system', 'Base de datos', { protocol: 'SQL' }],
      ],
      [
        ['user', 'client', 'invocation', 'Usa'],
        ['client', 'view', 'containment'],
        ['server', 'controller', 'containment'],
        ['server', 'model', 'containment'],
        ['view', 'controller', 'invocation', 'HTTP/JSON'],
        ['controller', 'model', 'dependency'],
        ['model', 'db', 'external-call'],
      ]
    ),
  },
];
