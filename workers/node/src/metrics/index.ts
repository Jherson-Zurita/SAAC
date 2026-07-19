/**
 * SAAC — Metrics Calculator
 * ==========================
 *
 * Calcula métricas locales (las que no requieren el grafo completo):
 *   - ClassMetrics: WMC, DIT, NOC, CBO, RFC, MPC, LCOM4, TCC, LCC
 *   - Module-level LCOM4 (componentes conectados del grafo clase-método-atributo)
 *
 * Las métricas de grafo (Ca, Instability, Distance, ModuleCohesion) se calculan
 * en Rust después de agregar todos los workers → WorkerModuleMetrics vs ModuleMetrics.
 *
 * Referencia: §4.3 de la especificación técnica.
 */

// ── Tipos locales ──

interface MethodInfo {
  name: string;
  cyclomaticComplexity: number;
  parameters: { name: string; type: string }[];
}

interface AttributeInfo {
  name: string;
  type: string;
}

interface ClassMetrics {
  wmc: number;
  dit: number;
  noc: number;
  cbo: number;
  rfc: number;
  mpc: number;
  lcom4: number;
  tcc: number;
  lcc: number;
}

interface ClassInfo {
  name: string;
  methods: MethodInfo[];
  attributes: AttributeInfo[];
  extends: string[];
}

// ── Class Metrics ──

/**
 * Calcula las métricas OOP de una clase individual (§4.3.1, §4.3.2, §4.3.3).
 *
 * @param methods - Métodos de la clase
 * @param attributes - Atributos de la clase
 * @returns ClassMetrics completas
 */
export function calculateClassMetrics(
  methods: MethodInfo[],
  attributes: AttributeInfo[]
): ClassMetrics {
  // WMC: Weighted Methods per Class = Σ CC de todos los métodos (§4.3.3)
  const wmc = methods.reduce((sum, m) => sum + m.cyclomaticComplexity, 0);

  // LCOM4: Lack of Cohesion in Methods (graph-based) (§4.3.2)
  // Se calcula como el número de componentes conectados en un grafo no dirigido
  // donde los nodos son métodos y existe arista si dos métodos comparten un atributo.
  const lcom4 = calculateLCOM4(methods, attributes);

  // TCC: Tight Class Cohesion (§4.3.2)
  // TCC = pares de métodos que comparten atributos directamente / total de pares posibles
  const { tcc, lcc } = calculateCohesionMetrics(methods, attributes);

  // RFC: Response For a Class (§4.3.1)
  // RFC = número de métodos propios + métodos llamados externamente
  // Simplificado: métodos propios (las llamadas externas se cuentan en la fase de agregación)
  const rfc = methods.length;

  // MPC: Message Passing Coupling (§4.3.1)
  // MPC = suma de llamadas a métodos externos
  // Se inicializa a 0, se completa en fase de agregación
  const mpc = 0;

  // CBO: Coupling Between Objects (§4.3.1)
  // Tipos únicos referenciados por la clase (via parámetros y atributos)
  const referencedTypes = new Set<string>();
  for (const attr of attributes) {
    if (attr.type !== 'any' && attr.type !== 'string' && attr.type !== 'number' && attr.type !== 'boolean' && attr.type !== 'void') {
      referencedTypes.add(attr.type);
    }
  }
  for (const method of methods) {
    for (const param of method.parameters) {
      if (param.type !== 'any' && param.type !== 'string' && param.type !== 'number' && param.type !== 'boolean' && param.type !== 'void') {
        referencedTypes.add(param.type);
      }
    }
  }
  const cbo = referencedTypes.size;

  return {
    wmc,
    dit: 0, // DIT se calcula en fase de agregación (requiere árbol de herencia completo)
    noc: 0, // NOC se calcula en fase de agregación (requiere conocer todas las clases)
    cbo,
    rfc,
    mpc,
    lcom4,
    tcc,
    lcc,
  };
}

// ── LCOM4 (Componentes Conectados) ──

/**
 * Calcula LCOM4 usando el algoritmo de componentes conectados (§4.3.2).
 *
 * 1. Construir grafo no dirigido: nodos = métodos
 * 2. Dos métodos están conectados si ambos referencian al menos un atributo común
 * 3. LCOM4 = número de componentes conectados
 *
 * LCOM4 = 1 → clase perfectamente cohesiva
 * LCOM4 > 1 → la clase debería dividirse en LCOM4 clases
 */
function calculateLCOM4(methods: MethodInfo[], attributes: AttributeInfo[]): number {
  if (methods.length === 0) return 0;
  if (attributes.length === 0) return methods.length; // Sin atributos, cada método es un componente

  // Para simplificar sin acceso al AST de los cuerpos de los métodos,
  // hacemos una heurística: si un método tiene parámetros con tipos que coinciden
  // con algún atributo, se considera que "usa" ese atributo.
  // Una implementación completa recorrería el AST del cuerpo del método.

  const attrNames = new Set(attributes.map((a) => a.name));
  const methodAttrs: Map<string, Set<string>> = new Map();

  for (const method of methods) {
    const usedAttrs = new Set<string>();
    // Heurística: si el nombre del atributo aparece en los nombres de parámetros
    // En una implementación completa, se recorrería el AST del body
    for (const attr of attrNames) {
      // Marca todos los atributos como potencialmente usados
      // (heurística conservadora hasta que tengamos análisis del body)
      usedAttrs.add(attr);
    }
    methodAttrs.set(method.name, usedAttrs);
  }

  // Union-Find para componentes conectados
  const parent: Map<string, string> = new Map();
  for (const m of methods) {
    parent.set(m.name, m.name);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }

  // Conectar métodos que comparten atributos
  const methodNames = methods.map((m) => m.name);
  for (let i = 0; i < methodNames.length; i++) {
    for (let j = i + 1; j < methodNames.length; j++) {
      const attrsI = methodAttrs.get(methodNames[i])!;
      const attrsJ = methodAttrs.get(methodNames[j])!;

      // ¿Comparten algún atributo?
      for (const attr of attrsI) {
        if (attrsJ.has(attr)) {
          union(methodNames[i], methodNames[j]);
          break;
        }
      }
    }
  }

  // Contar componentes
  const roots = new Set(methodNames.map((m) => find(m)));
  return roots.size;
}

// ── TCC / LCC ──

/**
 * Calcula TCC (Tight Class Cohesion) y LCC (Loose Class Cohesion) (§4.3.2).
 *
 * TCC = pares de métodos conectados directamente / total pares posibles
 * LCC = pares de métodos conectados directa o indirectamente / total pares posibles
 */
function calculateCohesionMetrics(
  methods: MethodInfo[],
  attributes: AttributeInfo[]
): { tcc: number; lcc: number } {
  const n = methods.length;
  if (n < 2) return { tcc: 1, lcc: 1 };

  const totalPairs = (n * (n - 1)) / 2;

  // Sin un análisis detallado del body de cada método,
  // devolvemos una heurística conservadora
  // En una implementación completa, se contarían los pares de métodos
  // que acceden a los mismos atributos.

  // Heurística: si hay atributos y métodos, asumir cohesión moderada
  if (attributes.length === 0) return { tcc: 0, lcc: 0 };

  // Por ahora, devolver 1 (totalmente cohesivo) como placeholder
  // hasta que tengamos análisis del body de los métodos
  return { tcc: 1, lcc: 1 };
}

// ── Module-level LCOM4 ──

/**
 * Calcula LCOM4 a nivel de módulo (§4.3.2).
 *
 * Para un módulo con múltiples clases, el LCOM4 es el número de
 * "clusters" independientes de clases (clases que no se referencian entre sí).
 *
 * LCOM4 = 1 → módulo cohesivo (todas las clases colaboran)
 * LCOM4 > 1 → módulo candidato a división
 */
export function calculateModuleMetrics(classes: ClassInfo[]): number {
  if (classes.length <= 1) return 1;

  // Para un módulo, LCOM4 es el número de componentes conectados
  // de clases que se referencian entre sí (vía herencia o composición)

  const classNames = new Set(classes.map((c) => c.name));
  const parent: Map<string, string> = new Map();

  for (const cls of classes) {
    parent.set(cls.name, cls.name);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }

  // Conectar clases que se referencian (herencia)
  for (const cls of classes) {
    for (const ext of cls.extends) {
      if (classNames.has(ext)) {
        union(cls.name, ext);
      }
    }
  }

  const roots = new Set([...classNames].map((name) => find(name)));
  return roots.size;
}
