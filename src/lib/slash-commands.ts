export interface ParsedSlashCommand {
  command: 'explain' | 'refactor' | 'metrics' | 'diagram' | null;
  prompt: string;
  contextType: string;
  targetId?: string;
}

export const AVAILABLE_SLASH_COMMANDS = [
  {
    command: '/explain',
    description: 'Explica la arquitectura o responsabilidad de un módulo/componente.',
    example: '/explain src/auth.ts',
  },
  {
    command: '/refactor',
    description: 'Propone una estrategia de refactorización para un antipatrón o módulo complejo.',
    example: '/refactor god-module',
  },
  {
    command: '/metrics',
    description: 'Analiza las métricas globales del proyecto (MI, Ca, Ce, Instabilidad).',
    example: '/metrics',
  },
  {
    command: '/diagram',
    description: 'Recomienda qué diagramas C4 o suplementarios revisar para este contexto.',
    example: '/diagram',
  },
];

export function parseSlashCommand(
  input: string,
  selectedId?: string | null
): ParsedSlashCommand {
  const trimmed = input.trim();

  if (trimmed.startsWith('/explain')) {
    const target = trimmed.replace('/explain', '').trim() || selectedId || 'proyecto';
    return {
      command: 'explain',
      prompt: `Por favor explica en detalle la responsabilidad, acoplamiento y estructura del objetivo "${target}".`,
      contextType: target === selectedId ? 'ModuleDetail' : 'FullAmg',
      targetId: target,
    };
  }

  if (trimmed.startsWith('/refactor')) {
    const target = trimmed.replace('/refactor', '').trim() || selectedId || 'antipatrón activo';
    return {
      command: 'refactor',
      prompt: `Brinda una guía paso a paso para refactorizar "${target}" y mejorar su mantenibilidad sin introducir regresiones.`,
      contextType: 'AntipatternDetail',
      targetId: target,
    };
  }

  if (trimmed.startsWith('/metrics')) {
    return {
      command: 'metrics',
      prompt: 'Resume el estado de las métricas clave de arquitectura ($Ca, Ce, I, A, D, LCOM4, MI$) del proyecto e identifica riesgos principales.',
      contextType: 'FullAmg',
    };
  }

  if (trimmed.startsWith('/diagram')) {
    return {
      command: 'diagram',
      prompt: '¿Qué diagramas (C4 Contexto, Contenedores, Componentes, Herencia, ER o Secuencia) debería consultar para entender los puntos débiles de la arquitectura?',
      contextType: 'FullAmg',
    };
  }

  return {
    command: null,
    prompt: input,
    contextType: 'FullAmg',
    targetId: selectedId || undefined,
  };
}
