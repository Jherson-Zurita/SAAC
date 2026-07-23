/**
 * SAAC — TypeScript/JavaScript AST Parser
 * =========================================
 *
 * Usa la TypeScript Compiler API (ts.createSourceFile) para parsear archivos
 * .ts/.tsx/.js/.jsx y extraer:
 *   - Imports (resueltos a IDs estables de módulo)
 *   - Clases / Interfaces con herencia, métodos, atributos
 *   - Funciones standalone exportadas
 *   - Llamadas HTTP externas (fetch, axios)
 *
 * Produce un WorkerAnalysisResult parcial que Rust luego agrega en el AMG.
 *
 * Referencia: §4.2.1, §4.2.2 de la especificación técnica.
 */

import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateModuleMetrics, calculateClassMetrics } from '../metrics/index.js';
import { detectModuleType } from '../extractors/index.js';
import { resolveImportPath } from './import-resolver.js';

// ── Tipos locales (espejo de shared/types.ts, sin import cruzado en runtime) ──

interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

interface AttributeInfo {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'package';
  isStatic: boolean;
  isReadonly: boolean;
}

interface MethodInfo {
  id: string;
  name: string;
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'package';
  isStatic: boolean;
  isAbstract: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  loc: number;
  calls: string[];
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
  id: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'package';
  methods: MethodInfo[];
  attributes: AttributeInfo[];
  extends: string[];
  implements: string[];
  metrics: ClassMetrics;
}

interface FunctionInfo {
  id: string;
  name: string;
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'package';
  isExported: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  loc: number;
  calls: string[];
}

interface Dependency {
  source: string;
  target: string;
  kind: string;
  weight: number;
}

interface ExternalCall {
  moduleId: string;
  externalSystemId: string;
  protocol: string;
  description: string;
}

interface Invocation {
  source: string;
  target: string;
  kind: 'call';
  weight: number;
}

export interface ParseResult {
  module: {
    id: string;
    type: 'module';
    name: string;
    moduleType: string;
    language: 'typescript' | 'javascript';
    loc: number;
    lloc: number;
    classes: ClassInfo[];
    functions: FunctionInfo[];
    imports: string[];
    importedBy: string[];
    stableSince: '';
    lastSeenIn: '';
    metrics: {
      ce: number;
      abstractness: number;
      lcom4: number;
      maintainabilityIndex: number;
      cyclomaticComplexityAvg: number;
      cyclomaticComplexityMax: number;
      connascence: undefined;
      quantumId: undefined;
    };
  };
  dependencies: Dependency[];
  invocations: Invocation[];
  externalCalls: ExternalCall[];
}

// ── Helpers de AST ──

function getVisibility(node: ts.Node): 'public' | 'private' | 'protected' {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers) {
    for (const mod of modifiers) {
      if (mod.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
      if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
    }
  }
  return 'public';
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === kind) ?? false;
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isAbstract(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.AbstractKeyword);
}

function isStatic(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.StaticKeyword);
}

function isReadonly(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ReadonlyKeyword);
}

function getTypeString(typeNode: ts.TypeNode | undefined): string {
  if (!typeNode) return 'any';
  return typeNode.getText();
}

function getNodeText(node: ts.Node): string {
  return node.getText();
}

function countLines(node: ts.Node, sourceFile: ts.SourceFile): number {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return end.line - start.line + 1;
}

function extractParameters(params: ts.NodeArray<ts.ParameterDeclaration>): ParameterInfo[] {
  return params.map((p) => ({
    name: p.name.getText(),
    type: p.type ? getTypeString(p.type) : 'any',
    isOptional: !!p.questionToken || !!p.initializer,
  }));
}

/**
 * Extrae los nombres de las llamadas a función (CallExpression) dentro de un nodo.
 * Reutilizado por extractFunction, extractExportedArrowFunction y métodos de clase.
 */
function extractCallNames(body: ts.Node): string[] {
  const calls: string[] = [];
  function visit(n: ts.Node): void {
    if (ts.isCallExpression(n)) {
      calls.push(n.expression.getText());
    }
    ts.forEachChild(n, visit);
  }
  ts.forEachChild(body, visit);
  return calls;
}

// ── Complejidad Ciclomática ──

/**
 * Calcula la complejidad ciclomática de un nodo de función/método.
 * CC = 1 + Σ(puntos de decisión)
 * Puntos: if, else if, case, for, while, do, catch, &&, ||, ??, ternario
 */
function calculateCyclomaticComplexity(node: ts.Node): number {
  let complexity = 1; // Base path

  function visit(n: ts.Node): void {
    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.ConditionalExpression: // ternario
      case ts.SyntaxKind.CaseClause:
        complexity++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const binary = n as ts.BinaryExpression;
        if (
          binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          binary.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          binary.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity++;
        }
        break;
      }
    }
    ts.forEachChild(n, visit);
  }

  ts.forEachChild(node, visit);
  return complexity;
}

// ── Complejidad Cognitiva ──

/**
 * Calcula la complejidad cognitiva (SonarSource style).
 * Incrementa por: estructuras de control + penalización por nivel de anidamiento.
 */
function calculateCognitiveComplexity(node: ts.Node): number {
  let complexity = 0;

  function visit(n: ts.Node, nestingLevel: number): void {
    let incrementsNesting = false;

    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.SwitchStatement:
      case ts.SyntaxKind.ConditionalExpression:
        complexity += 1 + nestingLevel; // +1 base + nesting penalty
        incrementsNesting = true;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const binary = n as ts.BinaryExpression;
        if (
          binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          binary.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          binary.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity += 1; // No nesting penalty for logical operators
        }
        break;
      }
    }

    ts.forEachChild(n, (child) => {
      visit(child, incrementsNesting ? nestingLevel + 1 : nestingLevel);
    });
  }

  ts.forEachChild(node, (child) => visit(child, 0));
  return complexity;
}

// ── Extractor de Clases ──

function extractClass(
  node: ts.ClassDeclaration | ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  moduleId: string
): ClassInfo {
  const name = node.name?.getText() ?? 'AnonymousClass';
  const isInterfaceNode = ts.isInterfaceDeclaration(node);
  const isAbstractClass = ts.isClassDeclaration(node) && isAbstract(node);

  // Heritage clauses (extends, implements)
  const extendsNames: string[] = [];
  const implementsNames: string[] = [];

  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      for (const type of clause.types) {
        const typeName = type.expression.getText();
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          extendsNames.push(typeName);
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          implementsNames.push(typeName);
        }
      }
    }
  }

  // Methods
  const methods: MethodInfo[] = [];
  const attributes: AttributeInfo[] = [];

  for (const member of node.members) {
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const methodName = member.name?.getText() ?? 'anonymous';
      const params = member.parameters ? extractParameters(member.parameters) : [];
      const returnType = member.type ? getTypeString(member.type) : 'void';
      const cc = ts.isMethodDeclaration(member) && member.body
        ? calculateCyclomaticComplexity(member.body)
        : 1;
      const cogComp = ts.isMethodDeclaration(member) && member.body
        ? calculateCognitiveComplexity(member.body)
        : 0;
      const calls = ts.isMethodDeclaration(member) && member.body
        ? extractCallNames(member.body)
        : [];

      methods.push({
        id: `${moduleId}::${name}::${methodName}`,
        name: methodName,
        visibility: getVisibility(member),
        isStatic: isStatic(member),
        isAbstract: ts.isMethodDeclaration(member) ? isAbstract(member) : isInterfaceNode,
        parameters: params,
        returnType,
        cyclomaticComplexity: cc,
        cognitiveComplexity: cogComp,
        loc: countLines(member, sourceFile),
        calls,
      });
    } else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      attributes.push({
        name: member.name?.getText() ?? 'unknown',
        type: member.type ? getTypeString(member.type) : 'any',
        visibility: getVisibility(member),
        isStatic: ts.isPropertyDeclaration(member) ? isStatic(member) : false,
        isReadonly: isReadonly(member),
      });
    } else if (ts.isConstructorDeclaration(member)) {
      // Extract constructor parameters with visibility modifiers as attributes
      for (const param of member.parameters) {
        const vis = getVisibility(param);
        if (vis !== 'public' || hasModifier(param, ts.SyntaxKind.PublicKeyword) || isReadonly(param)) {
          attributes.push({
            name: param.name.getText(),
            type: param.type ? getTypeString(param.type) : 'any',
            visibility: vis,
            isStatic: false,
            isReadonly: isReadonly(param),
          });
        }
      }

      // Constructor itself as a method
      methods.push({
        id: `${moduleId}::${name}::constructor`,
        name: 'constructor',
        visibility: getVisibility(member),
        isStatic: false,
        isAbstract: false,
        parameters: extractParameters(member.parameters),
        returnType: name,
        cyclomaticComplexity: member.body ? calculateCyclomaticComplexity(member.body) : 1,
        cognitiveComplexity: member.body ? calculateCognitiveComplexity(member.body) : 0,
        loc: countLines(member, sourceFile),
        calls: member.body ? extractCallNames(member.body) : [],
      });
    }
  }

  const classMetrics = calculateClassMetrics(methods, attributes);

  return {
    id: `${moduleId}::${name}`,
    name,
    isAbstract: isAbstractClass || isInterfaceNode,
    isInterface: isInterfaceNode,
    visibility: isExported(node) ? 'public' : 'private',
    methods,
    attributes,
    extends: extendsNames,
    implements: implementsNames,
    metrics: classMetrics,
  };
}

// ── Extractor de Funciones ──

function extractFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  moduleId: string
): FunctionInfo | null {
  // `export default function() {}` no tiene nombre en el AST: se le asigna
  // el nombre sintético 'default' para no perder el entry point del módulo.
  const isDefaultExport = hasModifier(node, ts.SyntaxKind.DefaultKeyword);
  const name = node.name?.getText() ?? (isDefaultExport ? 'default' : undefined);
  if (!name) return null; // Otras funciones anónimas sin nombre y sin ser default: se descartan

  const params = extractParameters(node.parameters);
  const returnType = node.type ? getTypeString(node.type) : 'void';
  const cc = node.body ? calculateCyclomaticComplexity(node.body) : 1;
  const cogComp = node.body ? calculateCognitiveComplexity(node.body) : 0;
  const calls = node.body ? extractCallNames(node.body) : [];

  return {
    id: `${moduleId}::${name}`,
    name,
    visibility: isExported(node) ? 'public' : 'private',
    isExported: isExported(node),
    parameters: params,
    returnType,
    cyclomaticComplexity: cc,
    cognitiveComplexity: cogComp,
    loc: countLines(node, sourceFile),
    calls,
  };
}

// ── Extractor de Exports de Arrow Functions / Variable Declarations ──

function extractExportedArrowFunction(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  moduleId: string
): FunctionInfo[] {
  const results: FunctionInfo[] = [];
  if (!isExported(node)) return results;

  for (const decl of node.declarationList.declarations) {
    if (!decl.initializer) continue;
    if (!ts.isArrowFunction(decl.initializer) && !ts.isFunctionExpression(decl.initializer)) continue;

    const name = decl.name.getText();
    const arrowFn = decl.initializer;
    const params = extractParameters(arrowFn.parameters);
    const returnType = arrowFn.type ? getTypeString(arrowFn.type) : 'void';
    const cc = arrowFn.body ? calculateCyclomaticComplexity(arrowFn.body) : 1;
    const cogComp = arrowFn.body ? calculateCognitiveComplexity(arrowFn.body) : 0;
    const calls = arrowFn.body ? extractCallNames(arrowFn.body) : [];

    results.push({
      id: `${moduleId}::${name}`,
      name,
      visibility: 'public',
      isExported: true,
      parameters: params,
      returnType,
      cyclomaticComplexity: cc,
      cognitiveComplexity: cogComp,
      // Nota: se usa `decl` (la declaración individual), no `node` (el
      // VariableStatement completo), para que cada arrow function en un
      // `export const a = ..., b = ...` tenga su propio conteo de líneas.
      loc: countLines(decl, sourceFile),
      calls,
    });
  }

  return results;
}

// ── Resolución de Invocations ──
//
// `calls` (ver extractCallNames) captura el TEXTO crudo de cada llamada tal
// como aparece en el código: "foo", "this.bar", "obj.baz", "pkg.mod.qux".
// Esta sección resuelve ese texto contra las funciones/métodos conocidos del
// PROPIO módulo, produciendo el arreglo "invocations" (grafo de llamadas
// intra-módulo). Llamadas a símbolos externos (imports, librerías, atributos
// de objetos de tipo desconocido) no se pueden resolver aquí de forma
// confiable — requerirían resolución de tipos, fuera del alcance de un
// parser de un solo archivo — y simplemente se omiten, en vez de adivinar.

/**
 * Construye índices para resolver llamadas dentro del módulo:
 *
 * - `bySimpleName`: nombre simple -> id calificado, para funciones
 *   top-level y para métodos (el último gana si hay colisión de nombres
 *   entre métodos de distintas clases, ya que sin inferencia de tipos no
 *   hay forma de saber a cuál clase pertenece el receptor).
 * - `methodsByClass`: nombre de clase -> Map(nombre_metodo -> id), para
 *   resolver llamadas con receptor conocido de forma explícita, como
 *   `this.foo(...)` dentro de una clase o `ClaseX.metodo(...)`.
 */
function buildCallIndex(
  classes: ClassInfo[],
  functions: FunctionInfo[]
): { bySimpleName: Map<string, string>; methodsByClass: Map<string, Map<string, string>> } {
  const bySimpleName = new Map<string, string>();
  const methodsByClass = new Map<string, Map<string, string>>();

  for (const fn of functions) {
    bySimpleName.set(fn.name, fn.id);
  }

  for (const cls of classes) {
    const classMethods = new Map<string, string>();
    methodsByClass.set(cls.name, classMethods);
    for (const m of cls.methods) {
      if (!m.id) continue;
      classMethods.set(m.name, m.id);
      // No sobreescribir una función top-level con el mismo nombre;
      // entre métodos de clases distintas, se queda el último visto.
      bySimpleName.set(m.name, m.id);
    }
  }

  return { bySimpleName, methodsByClass };
}

/**
 * Intenta resolver el texto de una llamada a un id calificado del módulo.
 *
 * Casos manejados, en orden:
 *   1. `this.metodo(...)` dentro de una clase: se resuelve contra los
 *      métodos de `callerClass` (receptor conocido).
 *   2. `NombreClase.metodo(...)`: se resuelve contra `methodsByClass` si
 *      `NombreClase` es una clase conocida del módulo (llamada estática o
 *      a través del nombre de la clase).
 *   3. `identificador_simple(...)`: se resuelve contra `bySimpleName`
 *      (función top-level o método, ver limitación en `buildCallIndex`).
 *   4. Cualquier otro caso (atributo de objeto de tipo desconocido, llamada
 *      encadenada, símbolo importado, builtin, etc.): no se resuelve — se
 *      devuelve null y el caller la descarta.
 */
function resolveCallTarget(
  callText: string,
  callerClass: string | null,
  bySimpleName: Map<string, string>,
  methodsByClass: Map<string, Map<string, string>>
): string | null {
  if (!callText.includes('.')) {
    return bySimpleName.get(callText) ?? null;
  }

  const parts = callText.split('.');
  if (parts.length !== 2) {
    // Llamadas encadenadas (a.b.c(...)) o con subíndices no se resuelven:
    // no hay suficiente información de tipos para saber el receptor real.
    return null;
  }

  const [receiver, methodName] = parts;

  if (receiver === 'this' && callerClass !== null) {
    return methodsByClass.get(callerClass)?.get(methodName) ?? null;
  }

  if (methodsByClass.has(receiver)) {
    return methodsByClass.get(receiver)!.get(methodName) ?? null;
  }

  return null;
}

/**
 * Construye el grafo de invocaciones (llamada función/método -> función/
 * método) dentro del propio módulo, a partir de los `calls` ya extraídos
 * por `extractFunction` / `extractExportedArrowFunction` / `extractClass`.
 *
 * Cada entrada resuelta produce:
 *   { source: <id del caller>, target: <id del callee>, kind: 'call', weight: N }
 * donde `weight` es el número de veces que `source` invoca a `target`
 * (llamadas repetidas al mismo target dentro del mismo caller se agregan,
 * en vez de producir entradas duplicadas).
 */
function extractInvocations(classes: ClassInfo[], functions: FunctionInfo[]): Invocation[] {
  const { bySimpleName, methodsByClass } = buildCallIndex(classes, functions);

  // "source_id::target_id" -> weight
  const weights = new Map<string, { source: string; target: string; weight: number }>();

  function accumulate(sourceId: string, callerClass: string | null, calls: string[]): void {
    for (const callText of calls) {
      const targetId = resolveCallTarget(callText, callerClass, bySimpleName, methodsByClass);
      if (targetId === null || targetId === sourceId) {
        continue; // No resuelto, o recursión directa (se omite).
      }
      const key = `${sourceId}::${targetId}`;
      const existing = weights.get(key);
      if (existing) {
        existing.weight += 1;
      } else {
        weights.set(key, { source: sourceId, target: targetId, weight: 1 });
      }
    }
  }

  for (const fn of functions) {
    accumulate(fn.id, null, fn.calls);
  }

  for (const cls of classes) {
    for (const m of cls.methods) {
      if (!m.id) continue;
      accumulate(m.id, cls.name, m.calls);
    }
  }

  return Array.from(weights.values()).map(({ source, target, weight }) => ({
    source,
    target,
    kind: 'call' as const,
    weight,
  }));
}

// ── Detector de llamadas HTTP externas ──

// Verbos HTTP reconocidos cuando el objeto que los invoca es 'axios' (o un
// alias directo del import 'axios', p.ej. `import api from 'axios'`).
const AXIOS_HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

function detectExternalCalls(sourceFile: ts.SourceFile, moduleId: string): ExternalCall[] {
  const calls: ExternalCall[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText();

      // Detect fetch() y variantes como this.fetch(), window.fetch()
      if (callText === 'fetch' || callText.endsWith('.fetch')) {
        const urlArg = node.arguments[0];
        const description = urlArg ? `fetch(${urlArg.getText().substring(0, 50)})` : 'fetch(...)';
        calls.push({
          moduleId,
          externalSystemId: 'http-api',
          protocol: 'http',
          description,
        });
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText() === 'axios' &&
        AXIOS_HTTP_METHODS.has(node.expression.name.text)
      ) {
        // Detect axios.get/post/put/delete/patch/head/options(...)
        const urlArg = node.arguments[0];
        const description = urlArg
          ? `axios ${node.expression.name.text}(${urlArg.getText().substring(0, 50)})`
          : callText;
        calls.push({
          moduleId,
          externalSystemId: 'http-api',
          protocol: 'http',
          description,
        });
      } else if (callText === 'axios') {
        // Detect axios(...) directo (config object) y axios.request(...)
        const urlArg = node.arguments[0];
        const description = urlArg ? `axios(${urlArg.getText().substring(0, 60)})` : 'axios(...)';
        calls.push({
          moduleId,
          externalSystemId: 'http-api',
          protocol: 'http',
          description,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return calls;
}

// ── LOC / LLOC ──

function calculateLoc(source: string): { loc: number; lloc: number } {
  const lines = source.split('\n');
  const loc = lines.length;
  let lloc = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }

    lloc++;
  }

  return { loc, lloc };
}

// ── Función principal de parsing ──

export async function parseTypeScriptFile(
  filePath: string,
  content?: string
): Promise<ParseResult> {
  // Leer el archivo si no se proporcionó el contenido
  const source = content ?? fs.readFileSync(filePath, 'utf-8');

  // Determinar el lenguaje
  const ext = path.extname(filePath).toLowerCase();
  const language: 'typescript' | 'javascript' = ['.ts', '.tsx'].includes(ext)
    ? 'typescript'
    : 'javascript';

  // Determinar el script kind
  const scriptKindMap: Record<string, ts.ScriptKind> = {
    '.ts': ts.ScriptKind.TS,
    '.tsx': ts.ScriptKind.TSX,
    '.js': ts.ScriptKind.JS,
    '.jsx': ts.ScriptKind.JSX,
  };
  const scriptKind = scriptKindMap[ext] ?? ts.ScriptKind.TS;

  // Parsear con TypeScript Compiler API
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind
  );

  // ID estable del módulo: path relativo normalizado
  const moduleId = filePath
    .replace(/\\/g, '/')
    .replace(/\.(ts|tsx|js|jsx)$/, '');

  // ── Extraer imports ──
  const imports: string[] = [];
  const dependencies: Dependency[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // import declarations: import { X } from './module'
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const resolvedId = resolveImportPath(specifier, filePath);

      if (resolvedId) {
        imports.push(resolvedId);
        dependencies.push({
          source: moduleId,
          target: resolvedId,
          kind: 'import',
          weight: 1,
        });
      }
    }

    // Dynamic imports: import('./module')
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        const specifier = (node.arguments[0] as ts.StringLiteral).text;
        const resolvedId = resolveImportPath(specifier, filePath);
        if (resolvedId) {
          imports.push(resolvedId);
          dependencies.push({
            source: moduleId,
            target: resolvedId,
            kind: 'import',
            weight: 1,
          });
        }
      }
    }
  });

  // ── Extraer clases, interfaces, funciones ──
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      classes.push(extractClass(node, sourceFile, moduleId));
    }

    if (ts.isFunctionDeclaration(node)) {
      const fn = extractFunction(node, sourceFile, moduleId);
      if (fn) functions.push(fn);
    }

    // Exported arrow functions: export const foo = () => { ... }
    if (ts.isVariableStatement(node)) {
      const arrowFns = extractExportedArrowFunction(node, sourceFile, moduleId);
      functions.push(...arrowFns);
    }
  });

  // ── Invocations (grafo de llamadas intra-módulo) ──
  const invocations = extractInvocations(classes, functions);

  // ── External calls ──
  const externalCalls = detectExternalCalls(sourceFile, moduleId);

  // ── LOC ──
  const { loc, lloc } = calculateLoc(source);

  // ── Module metrics (locales, sin métricas de grafo) ──
  const allComplexities = [
    ...functions.map((f) => f.cyclomaticComplexity),
    ...classes.flatMap((c) => c.methods.map((m) => m.cyclomaticComplexity)),
  ];

  const cyclomaticComplexityAvg =
    allComplexities.length > 0
      ? allComplexities.reduce((sum, cc) => sum + cc, 0) / allComplexities.length
      : 1;

  const cyclomaticComplexityMax =
    allComplexities.length > 0 ? Math.max(...allComplexities) : 1;

  // Abstractness: abstractions / total
  const totalClasses = classes.length;
  const abstractClasses = classes.filter((c) => c.isAbstract || c.isInterface).length;
  const abstractness = totalClasses > 0 ? abstractClasses / totalClasses : 0;

  // Ce: unique imports count
  const ce = new Set(imports).size;

  // LCOM4 at module level (simplified: components of the method-attribute graph)
  const lcom4 = calculateModuleMetrics(classes);

  // Maintainability Index (SEI formula adapted)
  // MI = 171 - 5.2 * ln(avgHalsteadVolume) - 0.23 * avgCC - 16.2 * ln(avgLOC)
  // Simplified: MI = max(0, (171 - 5.2 * ln(lloc) - 0.23 * ccAvg - 16.2 * ln(loc)) * 100 / 171)
  const llocSafe = Math.max(lloc, 1);
  const locSafe = Math.max(loc, 1);
  const rawMI = 171 - 5.2 * Math.log(llocSafe) - 0.23 * cyclomaticComplexityAvg - 16.2 * Math.log(locSafe);
  const maintainabilityIndex = Math.max(0, Math.min(100, (rawMI * 100) / 171));

  // ── Module type detection ──
  const moduleType = detectModuleType(filePath, classes, functions, imports);

  // ── Result ──
  const moduleName = path.basename(filePath, path.extname(filePath));

  return {
    module: {
      id: moduleId,
      type: 'module',
      name: moduleName,
      moduleType,
      language,
      loc,
      lloc,
      classes,
      functions,
      imports: [...new Set(imports)],
      importedBy: [], // Se llena en la fase de agregación (Rust)
      stableSince: '',
      lastSeenIn: '',
      metrics: {
        ce,
        abstractness,
        lcom4,
        maintainabilityIndex: Math.round(maintainabilityIndex * 100) / 100,
        cyclomaticComplexityAvg: Math.round(cyclomaticComplexityAvg * 100) / 100,
        cyclomaticComplexityMax,
        connascence: undefined,
        quantumId: undefined,
      },
    },
    dependencies,
    invocations,
    externalCalls,
  };
}