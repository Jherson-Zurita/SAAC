# SAAC v2.0 — Sistema de Análisis de Arquitectura de Código

### Documento de Especificación Técnica Completa

**Versión 2.0 — 2026**
`React` · `TypeScript` · `Tauri` · `Node.js` · `Python` · `IA Local`

> Basado en: *Fundamentals of Software Architecture, 2nd Ed.* (Richards & Ford) | *The C4 Model* (Simon Brown)

> ⚠️ **DOCUMENTO CONFIDENCIAL — USO INTERNO**

---

## 📑 Tabla de Contenidos

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura del Sistema SAAC](#2-arquitectura-del-sistema-saac)
3. [Architecture Model Graph (AMG) — Núcleo del Sistema](#3-architecture-model-graph-amg--núcleo-del-sistema)
4. [Módulos Funcionales Detallados](#4-módulos-funcionales-detallados)
   - [4.1 Detección de Proyecto](#41-módulo-de-detección-de-proyecto)
   - [4.2 Motor AST](#42-módulo-ast--motor-de-análisis-estático)
   - [4.3 Métricas Arquitectónicas](#43-módulo-de-métricas-arquitectónicas)
   - [4.4 Generación de Diagramas C4](#44-módulo-de-generación-de-diagramas-c4)
   - [4.5 Detección de Estilos Arquitectónicos](#45-módulo-de-detección-de-estilos-arquitectónicos)
   - [4.6 Detección de Antipatrones](#46-módulo-de-detección-de-antipatrones)
   - [4.7 Asistente IA Local](#47-módulo-de-ia-local--asistente-arquitectónico)
   - [4.8 Análisis de Riesgos Arquitectónicos](#48-módulo-de-análisis-de-riesgos-arquitectónicos)
   - [4.9 Gestión de Decisiones Arquitectónicas (ADRs)](#49-módulo-de-gestión-de-decisiones-arquitectónicas-adrs)
   - [4.10 Análisis de Impacto de Cambios](#410-módulo-de-análisis-de-impacto-de-cambios)
5. [Interfaz de Usuario — Diseño Detallado](#5-interfaz-de-usuario--diseño-detallado)
6. [Especificación Técnica](#6-especificación-técnica)
7. [Sistema de Reglas Arquitectónicas — Fitness Functions](#7-sistema-de-reglas-arquitectónicas--fitness-functions)
8. [Plan de Desarrollo — Roadmap](#8-plan-de-desarrollo--roadmap)
9. [Casos de Uso Detallados](#9-casos-de-uso-detallados)
10. [Requisitos No Funcionales](#10-requisitos-no-funcionales)
11. [Limitaciones, Riesgos y Mitigaciones](#11-limitaciones-riesgos-y-mitigaciones)
12. [Referencias Bibliográficas y Técnicas](#12-referencias-bibliográficas-y-técnicas)

---

## 1. Visión General del Proyecto

### 1.1 Descripción del Producto

**SAAC** (Sistema de Análisis de Arquitectura de Código) es una aplicación de escritorio multiplataforma que analiza automáticamente proyectos de software de cualquier tipo (web, servidor, móvil, desktop) para extraer, visualizar y evaluar su arquitectura real mediante análisis estático AST, generación de diagramas C4, cálculo de métricas arquitectónicas y asistencia de inteligencia artificial local.

El sistema opera **completamente offline**. Ningún fragmento de código del proyecto analizado sale de la máquina local. La IA corre mediante **Ollama** en la misma máquina, lo que garantiza privacidad total y hace viable su uso en entornos corporativos, regulados o con código propietario sensible.

> ### 💡 Propuesta de Valor Central
>
> SAAC convierte el código fuente real en **documentación arquitectónica viva**. En lugar de mantener diagramas a mano que siempre están desactualizados, SAAC lee el código y genera automáticamente la arquitectura que realmente existe — no la que se imaginó en el diseño inicial.

### 1.2 Problema que Resuelve

Los equipos de desarrollo enfrentan tres problemas recurrentes con la documentación arquitectónica:

1. Los diagramas se crean una vez y nunca se actualizan, divergiendo rápidamente de la realidad del código.
2. Las herramientas de análisis existentes son caras (*Structure101, NDepend*) o fragmentadas: unas solo hacen métricas, otras solo diagramas, sin integración.
3. No existe una solución que combine análisis multi-lenguaje + diagramas C4 automáticos + métricas de Richards & Ford + IA local en una sola herramienta gratuita y offline.

### 1.3 Usuarios Objetivo

| Perfil | Necesidad Principal | Casos de Uso |
|---|---|---|
| **Arquitecto de Software** | Documentar y auditar arquitecturas | Generar C4, medir fitness functions, detectar deuda arquitectónica |
| **Tech Lead / Senior Dev** | Entender proyectos heredados | Analizar legacy code, detectar antipatrones, planificar refactors |
| **Equipo de Onboarding** | Incorporar nuevos miembros | Compartir diagramas actualizados automáticamente |
| **Auditor / Consultor** | Evaluar proyectos de terceros | Reportes de salud arquitectónica con métricas objetivas |
| **DevOps / SRE** | Entender dependencias de despliegue | Diagramas de contenedores y despliegue C4 |

### 1.4 Alcance de la Versión 1.0 (mantenido para v2.0)

La versión 1.0 cubre análisis de proyectos individuales (mono-repositorios) con los siguientes lenguajes:

| Lenguaje                | Parser AST                           | Tipo de Proyecto                      |
| -------------------------| --------------------------------------| ---------------------------------------|
| TypeScript / JavaScript | `@typescript-eslint/parser`, `acorn` | Web, Server, Desktop (Electron/Tauri) |
| Python                  | `ast` módulo nativo + `tree-sitter`  | Server, Scripts, ML                   |
| Java                    | `javaparser` 3.x                     | Server (Spring, Jakarta EE)           |
| Kotlin                  | `kotlin-ast` via ANTLR4              | Server, Android                       |
| C# / .NET               | Roslyn `Microsoft.CodeAnalysis`      | Server, Desktop (WPF/MAUI)            |
| Swift                   | `swift-syntax` (proceso externo)     | iOS/macOS                             |
| Go                      | `go/ast` stdlib                      | Server, CLI                           |
| Rust                    | `syn` crate via proceso              | Server, Desktop (Tauri backend)       |

---

## 2. Arquitectura del Sistema SAAC

### 2.1 Visión de Alto Nivel

SAAC sigue una **arquitectura hexagonal (Ports & Adapters)** en el backend, con clara separación entre el dominio de análisis arquitectónico y los adaptadores de entrada/salida (parsers de lenguajes, renderizadores de diagramas, adaptadores de IA).

> ### 🏛️ Decisión Arquitectónica #001
>
> Se elige **Tauri v2** sobre Electron por: uso de RAM 5-8x menor (30-50MB vs 200-300MB), instalador 25x más pequeño (<10MB vs ~150MB), y backend Rust con seguridad por defecto. Crítico para coexistir con el proceso Ollama en 8GB de RAM.

### 2.2 Capas del Sistema

#### Capa 1 — Frontend (React + TypeScript)

Interfaz de usuario construida en React 18 con TypeScript estricto. Responsable exclusivamente de visualización y eventos de usuario. Se comunica con el backend Rust únicamente mediante el IPC de Tauri (llamadas tipadas, sin acceso directo a Node.js o Python).

- **Framework UI:** React 18 + Vite 5 + TypeScript 5.x
- **Estado global:** Zustand (ligero, sin boilerplate de Redux)
- **Gráficos y diagramas:** D3.js v7 + ReactFlow + Mermaid.js
- **Estilos:** TailwindCSS 3 (utility-first, sin CSS custom innecesario)
- **Componentes:** Radix UI (accesibles, sin opinión visual propia)
- **Tablas y métricas:** TanStack Table v8

#### Capa 2 — Backend Rust (Core Tauri)

El core Rust de Tauri actúa como orquestador: recibe comandos del frontend, spawna y gestiona los procesos de Node.js y Python, lee el sistema de archivos, gestiona la caché de análisis y se comunica con Ollama vía HTTP.

- **Gestión de procesos:** `tokio` runtime async
- **Cache de análisis:** `sled` (embedded key-value store en Rust)
- **Comunicación con Ollama:** `reqwest` HTTP client
- **Lectura de archivos:** `walkdir` + `ignore` (respeta `.gitignore`)
- **Serialización:** `serde_json` para comunicación entre capas

#### Capa 3 — Motor de Análisis Node.js

Proceso Node.js dedicado al análisis AST de lenguajes del ecosistema JavaScript/TypeScript. Se ejecuta como proceso hijo spawneado por Rust, recibe instrucciones vía stdin JSON y devuelve resultados vía stdout JSON.

- **Parser TS/JS:** `@typescript-eslint/parser` + TypeScript compiler API
- **Análisis de imports:** módulo nativo de resolución de módulos
- **Cálculo de métricas:** lógica propia sobre el AST
- **Detección de frameworks:** heurísticas sobre `package.json` + patrones AST

#### Capa 4 — Motor de Análisis Python

Proceso Python 3.11+ dedicado al análisis de Python, Java, Kotlin, C#, Swift, Go y Rust mediante `tree-sitter` (librería con bindings Python para ~40 lenguajes).

- **Parser multi-lenguaje:** `tree-sitter` 0.22+ con gramáticas por lenguaje
- **Análisis de cohesión:** LCOM4 calculado sobre el grafo de métodos/atributos
- **Detección de smells arquitectónicos:** algoritmos de análisis de grafos (`networkx`)
- **Exportación:** generación de Structurizr DSL, PlantUML, Mermaid

#### Capa 5 — Motor de IA Local (Ollama)

Proceso Ollama independiente que corre un LLM cuantizado. SAAC **no envía código crudo** a la IA; en cambio, envía el grafo de dependencias serializado en JSON y las métricas calculadas. Esto hace viable el análisis con modelos pequeños.

| | |
|---|---|
| **Modelo primario** | Qwen3 4B Q4_K_M (~2.5GB RAM) — mejor coding en su clase |
| **Modelo alternativo** | Phi-4 Mini 3.8B Q4_K_M (~2.2GB RAM) — más rápido, menos coding |
| **Modelo extendido** | Qwen2.5-Coder 7B (si hay >5GB libres) — mejor calidad |
| **Runtime** | Ollama vía API REST en `localhost:11434` |
| **Fallback** | Modo sin IA: solo métricas y diagramas, sin interpretación |

### 2.3 Flujo de Análisis Completo

El flujo de análisis sigue estos pasos en secuencia:

1. Usuario abre SAAC y selecciona la carpeta raíz del proyecto a analizar.
2. El backend Rust escanea el filesystem con `walkdir`, construye el árbol de archivos y detecta el tipo de proyecto (web/server/mobile/desktop) mediante heurísticas sobre archivos de configuración.
3. Rust despacha los archivos por lenguaje a los workers correspondientes (Node.js para TS/JS, Python para el resto).
4. Cada worker parsea los archivos con su motor AST, extrae el grafo de dependencias, las métricas de cohesión/acoplamiento y los patrones detectados. Devuelve un JSON normalizado.
5. Rust agrega todos los resultados en un modelo unificado: el **Architecture Model Graph (AMG)**, que es la representación interna completa del proyecto.
6. El AMG se persiste en caché (`sled`) junto con los hashes de los archivos. En análisis posteriores, solo se re-procesan los archivos modificados.
7. El frontend recibe el AMG y lo renderiza: diagramas C4, métricas, dependencias, radar chart.
8. En paralelo, SAAC envía un resumen del AMG (no el código) a Ollama. La IA genera observaciones, detecta antipatrones adicionales y prepara respuestas para el chat.

---

## 3. Architecture Model Graph (AMG) — Núcleo del Sistema

Este capítulo consolida en un único lugar todo lo relativo al AMG: qué es conceptualmente, cómo se modela su dominio, cómo se representa internamente (nodos, aristas, tipos), cómo se versiona entre análisis sucesivos, cómo se cachea y cómo se extiende mediante plugins. El resto del documento (módulos funcionales, diagramas, IA, fitness functions) consume el AMG definido aquí; ningún otro capítulo redefine su estructura.

### 3.1 Filosofía del AMG: Fuente Única de Verdad

Toda la arquitectura de SAAC gira alrededor de un principio central: **ningún módulo del sistema analiza el código fuente directamente**, salvo los workers de parsing. Todo lo demás — métricas, diagramas, detección de antipatrones, fitness functions, historial y el asistente de IA — opera exclusivamente sobre el AMG.

```
Código fuente → [Workers: Node.js / Python] → AMG → { Métricas, Diagramas, IA, Riesgos, Fitness Functions, Historial, ADRs }
```

Esto tiene tres consecuencias de diseño deliberadas:

- **Desacoplamiento:** un nuevo tipo de diagrama o una nueva métrica se implementa leyendo el AMG, sin tocar los parsers.
- **Eficiencia de IA:** al enviarse a Ollama el AMG resumido en JSON en lugar de código crudo, se reduce drásticamente el consumo de contexto y la superficie de alucinación del modelo (ver 4.7.2).
- **Coherencia:** todas las vistas del sistema (grafo de dependencias, C4, radar chart, chat IA) parten del mismo modelo, por lo que nunca pueden mostrar información contradictoria entre sí.

### 3.2 Modelo de Dominio del AMG

Antes de la estructura de datos serializada, es necesario fijar el modelo de dominio: las entidades conceptuales que existen en SAAC y cómo se relacionan jerárquicamente. Este modelo es agnóstico de lenguaje de implementación y sirve como contrato entre todos los módulos.

```
Project (1)
 │
 ├── AnalysisRun (0..N)              — una ejecución de análisis, ligada a un commit/hash
 │     ├── AMG (1)                    — el grafo resultante de esa ejecución
 │     │     ├── Module (0..N)
 │     │     │     ├── ClassInfo (0..N)
 │     │     │     ├── FunctionInfo (0..N)
 │     │     │     └── ModuleMetrics (1)
 │     │     ├── Dependency (0..N)     — arista entre dos Module
 │     │     ├── Container (0..N)      — agrupación nivel C4-2
 │     │     ├── ExternalSystem (0..N)
 │     │     ├── Actor (0..N)
 │     │     ├── Antipattern (0..N)
 │     │     └── ProjectMetrics (1)
 │     └── AIReport (0..1)             — reporte narrativo generado para esa corrida
 │
 ├── Rule (0..N)                      — definidas en .saac/rules.yaml
 ├── FitnessEvaluation (0..N)          — resultado de evaluar Rules contra un AMG específico
 ├── Risk (0..N)                       — riesgo detectado o registrado manualmente
 ├── ADR (0..N)                        — Architecture Decision Record, generado o manual
 ├── Annotation (0..N)                 — nota de usuario sobre un elemento del AMG
 └── History (1)                       — colección ordenada de AnalysisRun para el proyecto
```

**Reglas de dominio clave:**

- Un `Project` tiene exactamente un `History`, pero puede tener múltiples `AnalysisRun` (uno por análisis ejecutado, típicamente uno por commit relevante).
- Cada `AnalysisRun` produce exactamente un `AMG` inmutable. El AMG **nunca se edita in-place**; un nuevo análisis genera un nuevo AMG versionado (ver 3.4).
- `Rule`, `Risk`, `ADR` y `Annotation` son entidades que trascienden un único `AnalysisRun`: se definen a nivel de `Project` y se re-evalúan o re-vinculan contra cada nuevo AMG generado.
- `FitnessEvaluation` es el resultado de aplicar el conjunto de `Rule` vigente contra un AMG puntual; por eso se modela como entidad propia y no como campo del AMG.

### 3.3 Estructura Interna: Nodos y Aristas

El AMG es, en su núcleo, un grafo dirigido con nodos tipados y aristas tipadas. Esta sección formaliza esa estructura antes de la serialización JSON completa (ver 3.5).

#### 3.3.1 Tipos de Nodo

| Tipo de Nodo | Representa | Nivel C4 asociado |
|---|---|---|
| `Module` | Un archivo o unidad de compilación | Componente (Nivel 3) / Código (Nivel 4) |
| `Container` | Agrupación lógica de módulos (servicio, app, worker) | Contenedor (Nivel 2) |
| `ExternalSystem` | Sistema externo detectado (API de terceros, BD externa) | Contexto (Nivel 1) |
| `Actor` | Usuario o rol que interactúa con el sistema | Contexto (Nivel 1) |
| `ClassInfo` | Clase o interfaz dentro de un Module | Código (Nivel 4) |
| `FunctionInfo` | Función o método dentro de un Module/ClassInfo | Código (Nivel 4) |

#### 3.3.2 Tipos de Arista

| Tipo de Arista | Origen → Destino | Propiedades |
|---|---|---|
| `Dependency` | Module → Module | `kind` (import, HTTP call, DB access), `weight` (fuerza del acoplamiento) |
| `Containment` | Container → Module | jerárquica, sin peso |
| `Inheritance` | ClassInfo → ClassInfo | `kind` (extends, implements) |
| `Invocation` | FunctionInfo → FunctionInfo | usada para Call Graph y Sequence Diagrams |
| `ExternalCall` | Module → ExternalSystem | `protocol` (HTTP, gRPC, mensajería) |

#### 3.3.3 Propiedades Comunes a Todo Nodo

Todo nodo del AMG, sin importar su tipo, comparte un conjunto de propiedades base para permitir operaciones genéricas de la UI (selección, anotación, historial):

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | string | Identificador estable entre análisis (path normalizado o hash de firma) |
| `type` | enum | Uno de los tipos de nodo de 3.3.1 |
| `stableSince` | string (AnalysisRun id) | Primer análisis en el que este nodo apareció con este id |
| `lastSeenIn` | string (AnalysisRun id) | Último análisis en el que el nodo estuvo presente |
| `metrics` | object | Métricas específicas del tipo de nodo |

> La propiedad `id` estable es la que permite comparar dos AMGs de distintos análisis (ver 3.4) y saber si un nodo es "el mismo módulo que antes, modificado" o "un módulo nuevo".

### 3.4 Versionado del AMG

Cada ejecución de análisis genera un AMG completo e inmutable, identificado por el `AnalysisRun` que lo produjo. SAAC no versiona el AMG como un documento editado con diffs de texto, sino como una secuencia de snapshots enlazados, similar al modelo de Git para árboles.

#### 3.4.1 Estrategia de Versionado

```
AnalysisRun[N-1] ──(AMG v(N-1))──┐
                                  ├─▶ diff estructural ──▶ AMGDelta[N]
AnalysisRun[N]   ──(AMG vN)──────┘
```

| Concepto | Descripción |
|---|---|
| **AMG completo** | Se persiste íntegro solo cuando cambia una porción significativa del proyecto (ver política de snapshotting, 3.4.3). |
| **AMGDelta** | Diferencia estructural entre dos AMG consecutivos: nodos añadidos, eliminados, modificados (por cambio de métricas o de aristas), y aristas añadidas/eliminadas. |
| **Reconstrucción** | El AMG de cualquier `AnalysisRun` histórico se puede reconstruir aplicando la cadena de `AMGDelta` sobre el último snapshot completo anterior. |

#### 3.4.2 Identidad de Nodo entre Versiones

El campo `id` de cada nodo (3.3.3) se calcula de forma estable ante refactors menores: se basa en el path normalizado del archivo para `Module`, y en la firma de la clase/función (namespace + nombre) para `ClassInfo`/`FunctionInfo`, no en un UUID aleatorio por análisis. Esto permite que el módulo de Historial (5.1) trace la evolución de una métrica específica de un módulo a lo largo de decenas de commits, incluso si el archivo fue movido de carpeta (heurística de similitud de nombre + imports para detectar renombres/movimientos).

#### 3.4.3 Política de Snapshotting y Cache

| Regla | Detalle |
|---|---|
| **Snapshot completo** | Se genera en el primer análisis del proyecto y luego cada 20 `AnalysisRun` o cuando el `AMGDelta` acumulado supera el 30% de los nodos totales (lo que ocurra primero). |
| **Delta incremental** | Es el caso por defecto: solo se recalculan y persisten los módulos cuyo hash de archivo cambió (ver 2.3, paso 6). |
| **Cache física** | `sled` almacena `AMGSnapshot` y `AMGDelta` como entradas separadas, indexadas por `AnalysisRun.id` (hash de commit o timestamp si no hay git). |
| **Purga** | Configurable en `.saac/config.yaml`; por defecto se conservan los últimos 100 `AnalysisRun` o 90 días, lo que sea menor. |

### 3.5 Serialización — Esquema JSON del AMG

Esta es la representación serializada completa, usada para persistencia en `sled`, para el protocolo IPC hacia el frontend y para el resumen enviado a Ollama.

```typescript
interface ArchitectureModelGraph {
  amgId: string;                 // identificador de esta versión del AMG
  analysisRunId: string;         // AnalysisRun que lo produjo
  projectId: string;             // hash del path absoluto
  projectName: string;
  detectedType: ProjectType;     // web | server | mobile | desktop
  detectedStyle: ArchStyle;      // layered | hexagonal | microservices | ...
  styleConfidence: number;       // 0-1
  analyzedAt: string;            // ISO 8601
  parentAmgId: string | null;    // AMG anterior en la cadena de versionado (null si es el primero)
  snapshotType: "full" | "delta";
  modules: Module[];
  dependencies: Dependency[];    // Grafo: aristas entre módulos
  containers: Container[];       // Nivel C4-2
  externalSystems: ExternalSystem[];
  actors: Actor[];
  antipatterns: Antipattern[];
  metrics: ProjectMetrics;
  c4Models: C4Models;
}

interface Module {
  id: string;               // path relativo normalizado — estable entre versiones
  name: string;
  type: ModuleType;         // controller|service|repo|model|util|...
  language: Language;
  loc: number;
  lloc: number;
  classes: ClassInfo[];
  functions: FunctionInfo[];
  imports: string[];        // IDs de módulos que importa
  stableSince: string;      // primer AnalysisRun donde apareció este id
  lastSeenIn: string;       // último AnalysisRun donde estuvo presente
  metrics: ModuleMetrics;
}

interface ModuleMetrics {
  ca: number;                        // Afferent coupling
  ce: number;                        // Efferent coupling
  instability: number;               // 0-1
  abstractness: number;              // 0-1
  distance: number;                  // distancia de secuencia principal
  lcom4: number;
  maintainabilityIndex: number;      // 0-100
  cyclomaticComplexityAvg: number;
  cyclomaticComplexityMax: number;
  // Campos adicionales para Connascence y Quanta (ver 4.3.5 y 4.3.6)
  connascence?: ConnascenceMetrics;
  quantumId?: string;                // identificador del cuanto al que pertenece
}

interface AMGDelta {
  fromAmgId: string;
  toAmgId: string;
  addedModules: Module[];
  removedModuleIds: string[];
  modifiedModules: { id: string; before: Partial<Module>; after: Partial<Module> }[];
  addedDependencies: Dependency[];
  removedDependencies: Dependency[];
}
```

> **Nota:** las interfaces `Container`, `ExternalSystem`, `Actor`, `Antipattern`, `ProjectMetrics` y `C4Models` referenciadas arriba comparten el mismo estilo de modelado que `Module` y no se detallan campo por campo en este capítulo para evitar duplicación; este capítulo es la referencia normativa de `ArchitectureModelGraph`, `Module`, `ModuleMetrics` y `AMGDelta`, que son las estructuras sobre las que operan el resto de módulos (capítulo 4), la UI (capítulo 5) y las fitness functions (capítulo 7).

### 3.6 Arquitectura de Plugins sobre el AMG

La versión 1.0 fija el catálogo de lenguajes, diagramas, métricas y motor de IA soportados (secciones 1.4, 4.4 y 4.7). Para que SAAC sea extensible sin reescribir el core, toda futura capacidad se diseña desde ahora como un **plugin** que produce o consume AMG, nunca que accede al código fuente directamente salvo que sea, precisamente, un `LanguagePlugin`.

#### 3.6.1 Catálogo de Puntos de Extensión

| Tipo de Plugin | Entrada | Salida | Ejemplo |
|---|---|---|---|
| `LanguagePlugin` | Archivos fuente de un lenguaje | `Module[]`, `Dependency[]` parciales | Soporte para Zig, Elixir o COBOL en v2.0 |
| `MetricPlugin` | AMG completo o subgrafo | Campos adicionales en `ModuleMetrics` / `ProjectMetrics` | Métrica de deuda técnica basada en SonarQube rules |
| `DiagramPlugin` | AMG completo o subgrafo | Definición de diagrama (nodos + layout) | Diagrama de Bounded Contexts estilo DDD |
| `AIPlugin` | AMG resumido + prompt | Texto/JSON estructurado | Conector a una API externa (Claude, GPT) en vez de Ollama, ver 11.1 |
| `ExportPlugin` | AMG completo o diagrama | Archivo en formato destino | Exportador a Archi (ArchiMate) o a Confluence |
| `RulePlugin` | AMG + configuración | `FitnessEvaluation` parcial | Regla custom no expresable en el YAML declarativo de 7.2 |

#### 3.6.2 Contrato Mínimo de un Plugin

Todo plugin, independientemente de su tipo, implementa una interfaz mínima común para que el core Rust pueda descubrirlo, versionarlo y ejecutarlo de forma aislada:

```typescript
interface SaacPlugin {
  id: string;                 // identificador único, ej. "lang-zig"
  kind: "language" | "metric" | "diagram" | "ai" | "export" | "rule";
  version: string;            // semver del plugin
  apiVersion: string;         // versión del contrato AMG que consume/produce
  capabilities: string[];     // ej. ["parse", "extract-imports"] para LanguagePlugin
}
```

- **Aislamiento de proceso:** siguiendo el patrón ya usado para los workers de Node.js y Python (2.2, Capas 3 y 4), cada `LanguagePlugin` corre como proceso hijo independiente comunicado por JSON Lines. Un plugin de terceros mal construido no puede tumbar el core Rust.
- **Compatibilidad de esquema:** `apiVersion` permite que el core rechace o adapte plugins escritos contra una versión anterior del esquema del AMG (sección 3.5), evitando corrupción silenciosa del modelo.
- **Registro:** los plugins instalados se declaran en `.saac/plugins.yaml`, análogo en espíritu al `.saac/rules.yaml` de fitness functions (7.2).
- **Alcance v1.0:** en esta versión, los ocho lenguajes de 1.4, los diagramas de 4.4 y el motor Ollama de 4.7 se implementan como si fueran plugins internos (mismo contrato, sin mecanismo de carga dinámica de terceros). La carga dinámica de plugins externos queda planificada para v2.0 (ver 8.1, Fase 4 y 11.1).

---

## 4. Módulos Funcionales Detallados

### 4.1 Módulo de Detección de Proyecto

Este módulo es la entrada del sistema. Lee el filesystem y determina automáticamente qué tipo de proyecto es, qué lenguajes usa, y qué frameworks están presentes.

#### 4.1.1 Heurísticas de Detección

| Archivo / Patrón | Framework Detectado | Tipo de Proyecto |
|---|---|---|
| `package.json` → "react", "next", "vue", "angular" | React / Next.js / Vue / Angular | Web Frontend |
| `package.json` → "express", "fastify", "nestjs", "koa" | Express / Fastify / NestJS | Server Node.js |
| `requirements.txt` → "django", "flask", "fastapi" | Django / Flask / FastAPI | Server Python |
| `pom.xml` / `build.gradle` → spring-boot | Spring Boot | Server Java |
| `pubspec.yaml` → flutter | Flutter | Mobile |
| `android/AndroidManifest.xml` | Android nativo | Mobile |
| `ios/Info.plist` | iOS nativo | Mobile |
| `src-tauri/tauri.conf.json` | Tauri | Desktop |
| `electron.js` / `main.js` + electron en `package.json` | Electron | Desktop |
| `*.csproj` + WPF / MAUI referencias | WPF / MAUI | Desktop .NET |
| `go.mod` presente | Go module | Server / CLI |
| `Cargo.toml` presente | Rust/Cargo | Server / Desktop / CLI |

### 4.2 Módulo AST — Motor de Análisis Estático

#### 4.2.1 Qué extrae el AST

De cada archivo de código, el motor AST extrae:

- **Árbol de importaciones:** qué módulos importa cada archivo, resolviendo paths relativos y absolutos.
- **Declaraciones de clases/interfaces/funciones** con sus relaciones de herencia y composición.
- **Métricas de complejidad ciclomática** por función/método (número de caminos de ejecución posibles).
- **Visibilidad** (público/privado/protegido) de métodos y atributos, necesaria para LCOM.
- **Detección de patrones:** repositorios, servicios, controladores, DTOs, fábricas, etc.
- **Llamadas HTTP salientes** (`fetch`, `axios`, `RestTemplate`, `requests`) para mapear dependencias externas.
- **Conexiones a bases de datos** (cadenas de conexión, decoradores ORM, referencias a schemas).

#### 4.2.2 Arquitectura del Worker Node.js

El worker de Node.js implementa el análisis TypeScript/JavaScript con máxima fidelidad:

```
// Entrada: lista de archivos + configuración tsconfig.json
// Proceso: TypeScript Compiler API → AST → Walker → Extractor
// Salida: ModuleGraph JSON con nodos (archivos) y aristas (imports)
```

- **Resolución de módulos:** reproduce el algoritmo de resolución de Node.js y TypeScript (paths aliases, barrel exports, re-exports).
- **Análisis de tipos:** usa el `TypeChecker` de TypeScript para inferir tipos en variables sin anotación explícita.
- **Detección de frameworks:** identifica decoradores de NestJS (`@Controller`, `@Injectable`), hooks de React (`useState`, `useEffect`), etc.
- **Análisis de bundle:** detecta dynamic imports y code splitting points en aplicaciones web.

#### 4.2.3 Arquitectura del Worker Python (tree-sitter)

El worker Python usa `tree-sitter` como motor central para soportar múltiples lenguajes con una API unificada:

```python
# Gramáticas instaladas: python, java, kotlin, c_sharp, swift, go, rust
# Proceso por archivo: detect_language → load_grammar → parse → extract
# Caché de ASTs: evita re-parsear archivos no modificados (hash SHA256)
```

### 4.3 Módulo de Métricas Arquitectónicas

Implementa el catálogo de métricas definido por Richards & Ford en *"Fundamentals of Software Architecture"* más métricas clásicas de OOP, ampliado con Connascence y Architecture Quanta.

#### 4.3.1 Métricas de Acoplamiento

| Métrica | Descripción | Fórmula / Algoritmo | Umbral Saludable |
|---|---|---|---|
| **Ca** (Afferent Coupling) | Número de módulos externos que dependen de este módulo | Contar aristas entrantes en el grafo | Depende del rol; controllers: alto |
| **Ce** (Efferent Coupling) | Número de módulos de los que depende este módulo | Contar aristas salientes en el grafo | Ce < 10 para módulos centrales |
| **Instabilidad (I)** | Propensión a cambiar cuando cambian las dependencias | I = Ce / (Ca + Ce) | 0 = estable, 1 = inestable |
| **CBO** (Coupling Between Objects) | Acoplamiento entre clases OOP | Clases únicas referenciadas por una clase | CBO < 5-7 |
| **RFC** (Response For Class) | Métodos invocables dado un mensaje al objeto | Métodos propios + llamadas externas | RFC < 50 |
| **MPC** (Message Passing Coupling) | Llamadas a métodos externos | Suma de llamadas a objetos externos | MPC < 10 |

#### 4.3.2 Métricas de Cohesión

| Métrica                        | Descripción                                              | Fórmula                                         | Umbral                                     |
| --------------------------------| ----------------------------------------------------------| -------------------------------------------------| --------------------------------------------|
| **LCOM4**                      | Falta de cohesión en métodos (grafo de conectividad)     | Componentes conectados en grafo método-atributo | 1 = perfecto, >1 = clase debería dividirse |
| **TCC** (Tight Class Cohesion) | Métodos que comparten atributos directamente             | TCC = pares directos / total pares              | TCC > 0.5 deseable                         |
| **LCC** (Loose Class Cohesion) | Métodos que comparten atributos directa o indirectamente | LCC ≥ TCC                                       | LCC > 0.5                                  |
| **Cohesión de Módulo**         | Ratio de responsabilidades internas vs externas          | Imports internos / (internos + externos)        | > 0.6 sugiere buen encapsulamiento         |

#### 4.3.3 Métricas de Complejidad

| Métrica | Descripción | Cómo se Calcula |
|---|---|---|
| **Complejidad Ciclomática (CC)** | Caminos de ejecución posibles en una función | CC = E - N + 2P (aristas, nodos, componentes) |
| **WMC** (Weighted Methods per Class) | Complejidad total de una clase | WMC = Σ CC de todos los métodos |
| **Profundidad de Herencia (DIT)** | Niveles de herencia de una clase | Contar ancestros hasta la raíz |
| **NOC** (Number of Children) | Subclases directas | Contar clases que extienden directamente |
| **Complejidad Cognitiva** | Dificultad de entender el código (SonarSource) | Penaliza anidamiento y saltos no lineales |
| **Lines of Code (LOC/LLOC)** | Tamaño del módulo | LOC total y LLOC (lógicas, sin comentarios/blancos) |

#### 4.3.4 Métricas de Abstracción y Distancia

Estas métricas, centrales en Richards & Ford, miden si un módulo está en una posición arquitectónica saludable:

- **Abstractness (A):** ratio de elementos abstractos (interfaces, clases abstractas) sobre el total. A = abstracciones / (abstracciones + implementaciones). Rango: [0, 1].
- **Instabilidad (I):** ya definida. Rango: [0, 1].
- **Distancia de la Secuencia Principal (D):** D = |A + I - 1|. Los módulos con D cercano a 0 están en la zona saludable. D cercano a 1 indica "zona de dolor" (muy estable y concreto) o "zona de inutilidad" (muy abstracto e inestable).

#### 4.3.5 Análisis Avanzado de Connascence

SAAC implementará la taxonomía de connascence para medir la fuerza, localidad y grado del acoplamiento.

**Detección de Connascence Estática:** el motor AST buscará activamente:

- **De Nombre:** Acoplamiento por nombres de entidades.
- **De Tipo:** Dependencia de tipos de datos.
- **De Significado:** Uso de "números mágicos" o valores con significado implícito.
- **De Algoritmo:** Cuando dos componentes deben ejecutar el mismo algoritmo (ej. hashing) para ser correctos.

**Regla de Refactorización:** la herramienta sugerirá mover el código hacia formas de connascence más débiles (ej. de Significado a Nombre) para mejorar la mantenibilidad.

#### 4.3.6 Cálculo de Architecture Quanta

El sistema identificará los cuantos arquitectónicos del proyecto, definidos como unidades con alta cohesión funcional y un acoplamiento estático bajo que pueden desplegarse de forma independiente.

**Criterio de Identificación:** un cuanto incluye todos los componentes necesarios para funcionar, incluyendo su base de datos (si la tiene dedicada). Esto permitirá a SAAC distinguir entre un monolito (1 cuanto) y microservicios (n cuantos).

### 4.4 Módulo de Generación de Diagramas C4

Implementa los cuatro niveles del C4 Model de Simon Brown más los diagramas suplementarios, todos generados automáticamente desde el Architecture Model Graph.

#### 4.4.1 Nivel 1 — Diagrama de Contexto del Sistema

Muestra el sistema bajo análisis como una única caja, sus usuarios (inferidos de los puntos de entrada: controllers, CLI args, event handlers) y los sistemas externos con los que interactúa (APIs externas detectadas en el código, bases de datos, message brokers).

- **Inferencia de usuarios:** analiza los controladores/routers para identificar roles de usuario (ej: endpoint de admin vs endpoint público).
- **Sistemas externos:** detecta llamadas HTTP salientes, conexiones a bases de datos (cadenas de conexión), imports de SDKs externos (`aws-sdk`, `stripe`, `sendgrid`, etc.).
- **Renderizado:** ReactFlow con nodos customizados de tipo Persona, SistemaExterno, SistemaPropio.

#### 4.4.2 Nivel 2 — Diagrama de Contenedores

Descompone el sistema en sus unidades desplegables. Para un proyecto monolítico, identifica las capas como contenedores lógicos. Para proyectos con `docker-compose` o `kubernetes manifests`, lee la configuración real.

- **Fuentes de detección:** `docker-compose.yml`, `k8s/*.yaml`, `Procfile`, `serverless.yml`, `fly.toml`.
- **Contenedores inferidos:** si no hay configuración de despliegue, el sistema infiere contenedores desde la estructura de directorios y los puntos de entrada detectados.
- **Tecnología en cada contenedor:** lenguaje principal, framework, tipo (API, SPA, DB, Queue, Cache, Worker).

#### 4.4.3 Nivel 3 — Diagrama de Componentes

Descompone cada contenedor en sus componentes internos: módulos, paquetes, bounded contexts. Derivado directamente del grafo de imports del AST agrupado por directorio/feature.

- **Agrupación:** configurable por directorio (estructura física) o por dominio (estructura lógica inferida de nombres y dependencias).
- **Relaciones:** flechas con etiquetas que indican el tipo de dependencia (usa, llama, hereda de, implementa).
- **Indicadores visuales:** color coding por nivel de acoplamiento, tamaño del nodo proporcional al WMC.

#### 4.4.4 Nivel 4 — Diagrama de Código

Diagrama de clases UML generado automáticamente por el AST. Solo se genera para componentes seleccionados explícitamente, ya que a nivel de sistema completo sería inmanejable.

- **Generado bajo demanda:** el usuario hace doble clic en un componente en el nivel 3 para ver su diagrama de código.
- **Incluye:** herencia, implementación de interfaces, composición, atributos clave, métodos públicos.
- **Exportación:** PNG, SVG, PlantUML, Mermaid.

#### 4.4.5 Diagramas Suplementarios

Además de los tres diagramas suplementarios clásicos del C4 Model (Simon Brown), SAAC amplía el catálogo con diagramas adicionales derivados directamente del AMG, útiles para exploración estructural, navegación de código y comunicación con stakeholders no técnicos.

**Diagramas suplementarios C4 (Simon Brown)**

| Diagrama | Descripción |
|---|---|
| **System Landscape** | Mapa de todos los sistemas de la organización si se analizan múltiples proyectos. Muestra relaciones entre sistemas. |
| **Dynamic Diagram** | Flujo de una operación específica en el tiempo. Se genera desde la traza de llamadas de una función entry point seleccionada. |
| **Deployment Diagram** | Infraestructura real: servidores, contenedores Docker, zonas de red. Leído desde IaC (Terraform, CloudFormation) si existe. |

**Diagramas suplementarios adicionales (extensión propia de SAAC)**

| Diagrama | Descripción | Fuente de Datos |
|---|---|---|
| **Árbol de Directorios** (File Tree) | Representación jerárquica tipo árbol de la estructura física de carpetas y archivos del proyecto, con badges de lenguaje, tamaño en LOC y nivel de complejidad por color en cada nodo. Permite colapsar/expandir ramas. | `walkdir` sobre el filesystem, respetando `.gitignore` |
| **Mapa de Carpetas** (Folder / Treemap) | Treemap D3.js donde cada rectángulo es una carpeta o archivo; el área es proporcional al LOC y el color al Índice de Mantenibilidad. Útil para detectar de un vistazo dónde se concentra la complejidad. | AMG (`loc`, `maintainabilityIndex` por módulo) |
| **Árbol de Herencia** (Inheritance Tree) | Árbol jerárquico de clases e interfaces mostrando extends/implements en cascada, útil para detectar jerarquías excesivamente profundas (DIT alto) o God Classes en la raíz. | Relaciones de herencia extraídas por el AST |
| **Grafo de Llamadas** (Call Graph) | Grafo dirigido de invocaciones función → función, distinto del grafo de dependencias a nivel de módulo. Permite rastrear el flujo real de ejecución desde un entry point. | Análisis de llamadas del AST (Node.js/tree-sitter) |
| **Diagrama de Paquetes** (Package Diagram, UML) | Diagrama UML de paquetes/namespaces con relaciones de dependencia e importación entre ellos, siguiendo notación UML estándar en lugar de la notación libre del C4 nivel 3. | Agrupación de módulos por namespace/paquete |
| **Diagrama de Secuencia** (Sequence Diagram, UML) | Complementa el Dynamic Diagram del C4 con notación UML formal de líneas de vida y mensajes, generado automáticamente a partir de una traza de llamadas seleccionada. | Traza de llamadas + exportador PlantUML/Mermaid |
| **Diagrama Entidad-Relación** (ER Diagram) | Modelo de datos inferido de entidades ORM (decoradores, modelos Django/SQLAlchemy/TypeORM/Prisma), esquemas SQL o archivos de migración detectados en el proyecto. | Parsers específicos de ORM + lectura de migraciones/esquemas SQL |
| **Diagrama de Flujo de Datos** (DFD) | Muestra cómo fluye la información entre procesos, almacenes de datos y entidades externas, útil para auditorías de privacidad y trazabilidad de datos sensibles. | Combinación de llamadas HTTP, accesos a BD y AMG |
| **Mapa de Calor de Acoplamiento** (Coupling Heatmap) | Matriz módulo × módulo coloreada por intensidad de acoplamiento (número de dependencias cruzadas), útil para identificar clusters y candidatos a bounded contexts. | Matriz de adyacencia del grafo de dependencias |
| **Diagrama de Módulos Circulares** (Circular Dependency Graph) | Subgrafo aislado que muestra únicamente los ciclos de dependencia detectados, resaltando el camino exacto del ciclo y el punto sugerido de ruptura. | Resultado del algoritmo DFS de detección de ciclos |
| **Línea de Tiempo de Evolución** (Architecture Timeline) | Diagrama temporal (uno de los usos del módulo de Historial) que muestra cómo cambiaron métricas clave y estructura de módulos a través de commits de git. | Historial de AMGs cacheados por commit |
| **Mapa de Calor de Contribuciones** (Ownership Map) | Combina el árbol de carpetas con datos de git blame/git log para mostrar qué autores concentran más cambios en qué zonas del código, útil para bus-factor y planificación de onboarding. | `git log`/`blame` + árbol de directorios |

> **Nota de implementación:** todos los diagramas suplementarios adicionales comparten el mismo pipeline de exportación que los niveles C4 (PNG, SVG, Mermaid, PlantUML) y se generan bajo demanda desde el panel "Diagramas C4" mediante un selector de tipo de vista, sin requerir un nuevo análisis del proyecto.

#### 4.4.6 Estándares de Notación Profesional

Con el objetivo de generar diagramas arquitectónicos autocontenidos, consistentes y comprensibles sin necesidad de documentación adicional, SAAC aplicará automáticamente un conjunto de reglas de notación basadas en las recomendaciones del C4 Model.

**Plantilla de Elementos**

Cada elemento representado en los diagramas incluirá, de forma automática:

- Nombre del elemento.
- Tipo de elemento (Persona, Sistema, Contenedor, Componente, Código, Base de Datos, Cola de Mensajes, etc.).
- Tecnología principal utilizada (por ejemplo: Java + Spring Boot, React + TypeScript, PostgreSQL, Redis).
- Descripción funcional breve que resuma la responsabilidad del elemento dentro del sistema.

De esta forma, cada nodo será comprensible de manera independiente, incluso cuando el diagrama sea consultado fuera del contexto del proyecto.

**Relaciones Explícitas**

Todas las relaciones representadas por SAAC serán dirigidas y describirán explícitamente la naturaleza de la interacción. Cada conexión podrá incluir:

- Dirección de la dependencia o comunicación.
- Acción realizada (por ejemplo: consume, envía eventos, consulta, realiza peticiones API a, publica mensajes en).
- Protocolo o mecanismo técnico empleado (HTTP/HTTPS, JSON, gRPC, REST, GraphQL, AMQP, Kafka, JDBC, etc.).

**Leyendas Dinámicas**

SAAC generará automáticamente una Leyenda del Diagrama (Legend) adaptada a cada vista, indicando el significado de colores, formas de los nodos, estilos de línea, tipos de flechas, iconografía utilizada e indicadores visuales de métricas o riesgos. La leyenda se actualizará automáticamente cuando cambie el tipo de diagrama o se apliquen perspectivas adicionales.

#### 4.4.7 Implementación de Perspectivas

Además de los diagramas base, SAAC permitirá aplicar **Perspectivas** (Perspectives), agregando capas de información sobre el mismo modelo arquitectónico sin modificar la estructura del diagrama original. Cada perspectiva podrá activarse o desactivarse de forma independiente.

| Perspectiva | Descripción |
|---|---|
| **Seguridad** | Resalta protocolos de comunicación seguros, mecanismos de cifrado, autenticación, autorización, zonas de red, firewalls y otros elementos relacionados con la seguridad de la arquitectura. |
| **Propiedad (Ownership)** | Muestra el equipo, área o responsable asociado a cada sistema, contenedor o componente, facilitando la identificación de responsabilidades y el análisis organizacional del proyecto. |

Las perspectivas podrán combinarse entre sí, permitiendo visualizar simultáneamente diferentes dimensiones de la arquitectura sin alterar el modelo base representado por el AMG.

#### 4.4.8 Diagramas de Despliegue (Infraestructura)

Además del modelo lógico de la aplicación, SAAC generará diagramas que representen la infraestructura donde el sistema es desplegado, mostrando la relación entre los contenedores de software y los recursos físicos o virtuales que los hospedan, con visión clara de la arquitectura de ejecución en diferentes entornos (Desarrollo, Pruebas, Producción, etc.).

**Nodos de Despliegue** — SAAC identificará y representará automáticamente:

- Contenedores Docker.
- Máquinas virtuales.
- Instancias de nube (AWS EC2, Azure Virtual Machines, Google Compute Engine).
- Servidores de aplicaciones y de bases de datos.
- Clústeres Kubernetes.
- Zonas de disponibilidad y regiones cuando la información esté disponible.

**Nodos de Infraestructura** — el diagrama podrá incorporar:

- Balanceadores de carga, firewalls, gateways API.
- Servicios DNS, redes privadas y subredes.
- Proxies inversos.
- Servicios administrados en la nube (Cloudflare, AWS ALB, Azure Load Balancer, Google Cloud Load Balancing, etc.).

Toda esta información será inferida a partir de archivos de configuración, manifiestos de despliegue e infraestructura como código detectados en el proyecto.

#### 4.4.9 Diagramas Dinámicos (Comportamiento en Runtime)

Con el fin de representar el comportamiento del sistema durante la ejecución y evitar la complejidad de grandes diagramas estáticos, SAAC generará automáticamente diagramas dinámicos centrados en escenarios o casos de uso específicos, inspirados en los Diagramas de Colaboración y Secuencia de UML.

**Generación Basada en Casos de Uso** — el usuario podrá seleccionar un punto de entrada del sistema, como:

- Inicio de sesión, registro de usuarios.
- Procesamiento de pedidos, pago de una compra.
- Envío de notificaciones.
- Cualquier controlador, endpoint, comando o evento detectado por el análisis estático.

A partir de dicho punto de entrada, SAAC reconstruirá el flujo de ejecución utilizando el AMG y el grafo de llamadas, generando automáticamente una vista dinámica de la colaboración entre los componentes involucrados.

**Información Representada** — cada diagrama dinámico podrá mostrar: secuencia de invocaciones entre componentes, mensajes intercambiados, protocolos de comunicación utilizados, dependencias activadas durante la ejecución, accesos a bases de datos, publicación/consumo de eventos e interacción con servicios externos.

### 4.5 Módulo de Detección de Estilos Arquitectónicos

Clasifica automáticamente el proyecto en uno de los estilos del catálogo de Richards & Ford, usando las métricas y patrones detectados.

| Estilo Detectado | Señales de Detección | Confianza |
|---|---|---|
| **Layered / N-Tier** | Directorios: `controllers/`, `services/`, `repositories/`. Dependencias unidireccionales entre capas. | Alta si estructura es clara |
| **Modular Monolith** | Módulos con alta cohesión interna y bajo acoplamiento entre ellos. Sin servicios separados. | Media-Alta |
| **Microservicios** | `docker-compose` con múltiples servicios. APIs entre servicios. Bases de datos separadas por servicio. | Alta si hay docker-compose |
| **Hexagonal / Clean** | Carpetas: `domain/`, `application/`, `infrastructure/`, `ports/`, `adapters/`. Interfaces en dominio. | Alta si estructura es clara |
| **Event-Driven** | Referencias a message brokers (RabbitMQ, Kafka, SQS). Patrón Publisher/Subscriber. | Alta si hay brokers |
| **Microkernel / Plugin** | Sistema de plugins/extensiones. Core pequeño con módulos opcionales cargados dinámicamente. | Media |
| **CQRS / Event Sourcing** | Segregación Command/Query en código. Event stores. Proyecciones. | Alta si hay patrones explícitos |
| **Big Ball of Mud** (antipatrón) | Acoplamiento circular extenso. D cercano a 1 en mayoría de módulos. Sin estructura clara. | Alta desafortunadamente |

#### Análisis Complementario del Estilo Detectado

**Análisis de Isomorfismo Arquitectónico:** SAAC comparará la estructura real del proyecto (AMG) con el modelo de referencia del estilo arquitectónico detectado mediante un análisis de isomorfismo, determinando el grado de correspondencia entre la arquitectura implementada y la esperada, detectando degradaciones estructurales como:

- Bypass entre capas en arquitecturas Layered.
- Dependencias no permitidas entre módulos.
- Violaciones de límites arquitectónicos.
- Acoplamientos que rompen el estilo detectado.
- Evolución progresiva hacia una arquitectura tipo Big Ball of Mud.

Cuando el porcentaje de similitud disminuya por debajo de determinados umbrales, SAAC notificará la pérdida de integridad arquitectónica y mostrará los elementos responsables de la degradación.

**Calificación de Superpoderes Arquitectónicos:** para cada estilo detectado, SAAC evaluará qué tan bien el proyecto está aprovechando las ventajas inherentes de dicho estilo ("Architectural Superpowers"), mostrando una calificación de 1 a 5 estrellas para cada característica relevante.

| Estilo | Superpoder Evaluado | Calificación |
|---|---|---|
| Microservicios | Escalabilidad independiente | ★★★★★ |
| Microservicios | Despliegue independiente | ★★★★☆ |
| Layered | Separación de responsabilidades | ★★★★★ |
| Layered | Aislamiento entre capas | ★★★☆☆ |
| Hexagonal | Independencia de infraestructura | ★★★★★ |
| Event-Driven | Desacoplamiento mediante eventos | ★★★★☆ |

Esta evaluación permitirá determinar si la implementación realmente obtiene los beneficios del estilo arquitectónico identificado o si presenta deficiencias que reducen sus ventajas esperadas.

### 4.6 Módulo de Detección de Antipatrones

Detecta violaciones arquitectónicas usando análisis de grafos sobre el AMG:

- **Dependencias cíclicas:** algoritmo DFS para detectar ciclos en el grafo de dependencias. Visualiza el ciclo y sugiere cómo romperlo (inyección de dependencias, inversión de dependencia).
- **God Module:** módulos con Ce (efferent coupling) > 15 o con más del 20% de todas las dependencias del sistema. Candidatos a división.
- **Violación de capas:** dependencias en sentido incorrecto según el estilo detectado (ej: servicio importando desde controller en arquitectura layered).
- **Shotgun Surgery:** cambio en un módulo que requiere cambios en muchos otros (Ca alto + módulos con bajo LCOM).
- **Feature Envy:** una clase que usa más métodos de otra clase que los propios.
- **Lollipop Problem:** muchas interfaces con una sola implementación sin justificación (over-engineering).
- **Concrete Class Dependency:** capas de alto nivel dependiendo directamente de implementaciones concretas en lugar de abstracciones.

### 4.7 Módulo de IA Local — Asistente Arquitectónico

El asistente de IA usa el modelo local vía Ollama para proporcionar interpretación inteligente del análisis.

#### 4.7.1 Modos de Operación

| Modo                        | Descripción                                                                                                                                                                                  |
| -----------------------------| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Análisis Automático**     | Al completar el análisis AST, SAAC envía el AMG resumido a la IA. Esta genera un reporte narrativo: qué hace el sistema, cómo está estructurado, qué problemas detecta, qué priorizar.       |
| **Chat Contextual**         | El usuario puede hacer preguntas en lenguaje natural. La IA tiene el contexto del AMG completo como contexto de sistema, por lo que puede responder preguntas específicas sobre el proyecto. |
| **Explicación de Métricas** | Al hacer clic en cualquier métrica, la IA explica qué significa en el contexto de este proyecto específico, no solo una definición genérica.                                                 |
| **Sugerencias de Refactor** | Para cada antipatrón detectado, la IA propone un plan de refactoring concreto: qué mover, cómo renombrar, qué extraer.                                                                       |
| **Generación de ADRs**      | La IA detecta decisiones arquitectónicas implícitas en el código y genera borradores de Architecture Decision Records (ADRs) en formato MADR.                                                |

#### 4.7.2 Estrategia de Prompting para Modelos Pequeños

Los modelos de 4B parámetros tienen contexto y capacidad de razonamiento limitados. La estrategia de prompting compensa esto:

- El AMG se serializa como JSON compacto con solo las métricas clave, no el código crudo.
- Se usa Chain-of-Thought prompting: *"Analiza paso a paso: 1) Lista los problemas de acoplamiento, 2) Evalúa la cohesión, 3) Concluye sobre el estilo arquitectónico."*
- Las respuestas se limitan a 500 tokens para evitar alucinaciones por contexto largo.
- Para preguntas de chat, el contexto se resume dinámicamente al módulo relevante para la pregunta, no al sistema completo.
- Se implementa validación de respuestas: si la IA menciona elementos que no existen en el AMG, se descarta y se reintenta con más contexto.

### 4.8 Módulo de Análisis de Riesgos Arquitectónicos

Este módulo evalúa los riesgos estructurales del sistema a partir de las métricas calculadas, el AMG y los resultados del análisis arquitectónico, priorizando los componentes que representan un mayor riesgo para la evolución y mantenimiento del software.

#### 4.8.1 Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Matriz de Riesgo Automatizada** | SAAC genera automáticamente una matriz de riesgos cruzando los componentes críticos del sistema con sus características arquitectónicas (disponibilidad, escalabilidad, mantenibilidad, modificabilidad, resiliencia, rendimiento y seguridad), permitiendo visualizar el impacto y la probabilidad de cada riesgo identificado. |
| **Identificación de Zonas de Dolor** | Detecta automáticamente módulos con alta inestabilidad, bajo nivel de abstracción, elevado acoplamiento o concentración excesiva de dependencias, clasificándolos como puntos críticos para futuras modificaciones y refactorizaciones. |
| **Filtro de Señal/Ruido** | Permite ocultar riesgos de baja prioridad y mostrar únicamente aquellos con mayor impacto arquitectónico, facilitando la identificación de los "puntos calientes" del sistema durante el análisis. |

#### 4.8.2 Evaluación y Priorización de Riesgos

Para cada componente analizado, SAAC calculará un nivel de riesgo considerando factores como:

- Acoplamiento aferente y eferente.
- Índice de inestabilidad.
- Distancia respecto a la Main Sequence.
- Complejidad estructural.
- Violaciones arquitectónicas detectadas.
- Antipatrones presentes.
- Frecuencia e impacto de las dependencias.

Cada riesgo será clasificado mediante una combinación de probabilidad e impacto, permitiendo priorizar las acciones de mantenimiento y refactorización sobre los componentes más críticos del sistema.

### 4.9 Módulo de Gestión de Decisiones Arquitectónicas (ADRs)

Este módulo complementa al Asistente de IA permitiendo documentar automáticamente las decisiones arquitectónicas identificadas durante el análisis del proyecto. A partir del AMG, las métricas calculadas y los patrones detectados, SAAC intentará inferir no solo qué decisiones fueron tomadas, sino también por qué fueron adoptadas.

#### 4.9.1 Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Inferencia de Decisiones Arquitectónicas** | Analiza la estructura del proyecto para identificar decisiones arquitectónicas implícitas, como la adopción de un estilo arquitectónico, patrones de diseño, mecanismos de comunicación entre componentes o estrategias de persistencia. |
| **Documentación del "Porqué"** | A partir del contexto del análisis, la IA genera una explicación razonada sobre las posibles motivaciones que llevaron a la adopción de cada decisión arquitectónica, indicando además el nivel de confianza de la inferencia. |
| **Generación Automática de ADRs** | Produce borradores de Architectural Decision Records (ADR) para cada decisión detectada, listos para ser revisados, editados y aprobados por el equipo de desarrollo. |
| **Gestión del Historial de Decisiones** | Permite almacenar, consultar y versionar los ADRs generados, facilitando el seguimiento de la evolución arquitectónica del proyecto a lo largo del tiempo. |

#### 4.9.2 Formato MADR

Los ADRs generados por SAAC seguirán la estructura Markdown Architectural Decision Records (MADR), incluyendo:

- Título de la decisión.
- Estatus (Propuesta, Aceptada, Reemplazada, Obsoleta, etc.).
- Contexto, describiendo las fuerzas, restricciones y necesidades que motivaron la decisión.
- Decisión, indicando la solución arquitectónica adoptada.
- Consecuencias, detallando los beneficios, limitaciones y trade-offs asociados.
- Cumplimiento, verificando automáticamente si la implementación actual continúa respetando la decisión documentada.

#### 4.9.3 Validación Continua

Durante cada nuevo análisis del proyecto, SAAC comparará la implementación actual con los ADRs existentes para detectar desviaciones arquitectónicas, identificar decisiones que hayan dejado de cumplirse y sugerir la actualización o creación de nuevos registros cuando sea necesario.

### 4.10 Módulo de Análisis de Impacto de Cambios

Este módulo permite evaluar proactivamente el impacto potencial de cambios propuestos en la arquitectura del sistema, ayudando a predecir consecuencias antes de realizar modificaciones en el código.

#### 4.10.1 Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Simulación de Cambios** | Permite simular modificaciones en el AMG, como la reubicación de componentes, la modificación de dependencias o la introducción de nuevas reglas, para predecir su impacto en métricas y estructura. |
| **Análisis Predictivo** | Utiliza modelos predictivos basados en el historial del proyecto para estimar cómo afectarán los cambios propuestos al Índice de Mantenibilidad, la Complejidad Ciclomática, el Índice de Estabilidad y otros indicadores clave. |
| **Evaluación de Riesgos** | Identifica riesgos asociados a los cambios propuestos, como posibles violaciones de arquitectura, aumento de acoplamiento o introducción de nuevos antipatrones, antes de que se implementen en el código. |
| **Generación de Recomendaciones** | Basándose en los resultados de la simulación, SAAC genera recomendaciones sobre cómo realizar los cambios minimizando el impacto negativo en la arquitectura y sugiriendo alternativas más beneficiosas. |

#### 4.10.2 Escenarios de Uso

El módulo permite simular escenarios como:

- Mover un servicio de un dominio a otro.
- Introducir una nueva capa de abstracción.
- Eliminar una dependencia entre módulos.
- Refactorizar un componente con alta complejidad.
- Introducir nuevos patrones de diseño o architectural decisions.

Para cada escenario, SAAC calculará las métricas resultantes, identificará los componentes más afectados y generará un informe detallado del impacto potencial.

---

## 5. Interfaz de Usuario — Diseño Detallado

> **Nota de revisión:** la especificación original modelaba la UI como una app tipo dashboard web (sidebar fijo + paneles), lo cual no comunica que SAAC es una herramienta de análisis profesional con la densidad de información de un IDE. Esta versión redefine la interfaz siguiendo el modelo de composición de un IDE completo (Visual Studio, JetBrains, VS Code): Menu Bar, Toolbars, panel de exploración lateral, panel de propiedades, Output/Terminal y Status Bar. El panel de navegación de la versión original (5.2, antes 4.1) se conserva pero se integra como parte del Leftbar, no como la única estructura de navegación de la app.

### 5.1 Arquitectura General de la Interfaz (Modelo tipo IDE)

SAAC adopta el layout de composición estándar de un IDE profesional en lugar de un dashboard plano. Esto es intencional: un arquitecto de software auditando un proyecto de 80,000 LOC necesita las mismas convenciones espaciales que ya conoce de su editor.

| Región en SAAC | Equivalente en IDEs de referencia | Posición |
|---|---|---|
| **Topbar** | Menu Bar + Toolbars (Visual Studio) | Superior, fija |
| **Leftbar** | Solution Explorer / Toolbox | Lateral izquierdo, colapsable |
| **Rightbar** | Properties Window | Lateral derecho, colapsable |
| **Canvas central** | Editor de código / diseñador visual | Centro, siempre visible |
| **Downbar** | Output Window + Terminal + Status Bar | Inferior, con pestañas y franja de estado |

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MENU BAR: File  Edit  View  Project  Analysis  Diagrams  AI  Help      │  ← 5.1.1
├─────────────────────────────────────────────────────────────────────────┤
│  TOOLBAR: [▶ Analizar] [⏹] [💾] [🔍 Buscar] [⚙️] │ Layout: Dagre ▾      │  ← 5.1.2
├───────────────┬─────────────────────────────────────────┬───────────────┤
│               │                                          │               │
│   LEFTBAR     │              CANVAS CENTRAL              │   RIGHTBAR    │
│  (Solution    │      (Dashboard / C4 / Grafo / Chat)     │  (Properties  │
│   Explorer)   │                                          │   Window)     │
│   5.1.3       │                                          │   5.1.4       │
│               │                                          │               │
├───────────────┴─────────────────────────────────────────┴───────────────┤
│  DOWNBAR: [Output] [Terminal] [Problemas] [Historial de Análisis]        │  ← 5.1.5
├─────────────────────────────────────────────────────────────────────────┤
│  STATUS BAR: ● Analizado hace 2 min │ 342 módulos │ Ollama: activo │ RAM │  ← 5.1.6
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.1 Menu Bar

Barra de menú clásica, siempre visible, con navegación completa por teclado (Alt + letra subrayada) además de mouse:

| Menú | Contenido principal |
|---|---|
| **File** | Abrir proyecto, Abrir reciente, Cerrar proyecto, Exportar modelo (`saac-model.json`), Importar modelo, Salir |
| **Edit** | Deshacer/Rehacer anotaciones, Preferencias, Buscar en el proyecto (Ctrl+Shift+F sobre el AMG) |
| **View** | Mostrar/ocultar Leftbar, Rightbar, Downbar; Zoom del canvas; Paletas de color (claro/oscuro/alto contraste) |
| **Project** | Volver a analizar, Configurar `.saac/rules.yaml`, Configurar `.saac/plugins.yaml`, Ignorar rutas |
| **Analysis** | Ejecutar análisis completo, Ejecutar análisis incremental, Ver historial de AnalysisRun, Comparar dos versiones del AMG |
| **Diagrams** | Generar cada tipo de diagrama del catálogo (4.4), Exportar diagrama activo, Modo edición de diagrama |
| **AI** | Activar/desactivar asistente, Cambiar modelo Ollama, Ver/editar prompt de sistema, Exportar conversación |
| **Help** | Documentación, Atajos de teclado, Acerca de, Reportar problema |

#### 5.1.2 Toolbars

Barra de iconos de acceso rápido bajo el Menu Bar, con las acciones más frecuentes — equivalente directo a la Toolbar de Visual Studio. Es contextual: cambia ligeramente según la vista activa en el canvas central.

| Grupo | Controles |
|---|---|
| **Análisis** | ▶ Analizar proyecto · ⏹ Detener análisis en curso · ⟳ Re-analizar incremental |
| **Proyecto** | 📂 Abrir carpeta · 💾 Exportar modelo · 🔍 Buscador global (módulos, clases, funciones) |
| **Vista** | Selector de Layout de grafo (Dagre / ELK / Force-Directed) · Zoom (+/−/Fit) · Alternar tema |
| **Diagramas** | Selector rápido de tipo de diagrama (dropdown con los 14 tipos del catálogo, 4.4) |
| **IA** | 🤖 Toggle asistente activo · Indicador de modelo cargado (Qwen3 4B / Phi-4 Mini) |

Las toolbars son reordenables y ocultables desde `View → Toolbars`, igual que en Visual Studio/JetBrains, para que usuarios avanzados personalicen su espacio de trabajo.

#### 5.1.3 Leftbar — Solution Explorer del Proyecto

Panel lateral izquierdo, colapsable, que reemplaza y extiende la navegación plana de la versión anterior. Tiene dos pestañas conmutables:

| Pestaña | Contenido |
|---|---|
| **Explorador** | Árbol de archivos real del proyecto analizado (equivalente al File Tree de 4.4), con badges de lenguaje, LOC y nivel de complejidad por color. Doble clic en un módulo lo abre en el canvas central (grafo o C4 nivel 3). |
| **Navegación SAAC** | Las secciones funcionales de la app — Dashboard, Diagramas C4, Métricas, Antipatrones, Asistente IA, Historial, Configuración (5.2) — ahora como árbol de navegación dentro del Leftbar en lugar de ser la interfaz completa. |

Un divisor arrastrable permite redimensionar el Leftbar; un botón de pin/auto-hide lo colapsa a una franja de iconos, liberando espacio para el canvas central en pantallas pequeñas.

#### 5.1.4 Rightbar — Properties Window

Panel lateral derecho, colapsable, que muestra las propiedades del elemento actualmente seleccionado en el canvas central (nodo del grafo, elemento de un diagrama C4, fila de la tabla de métricas). Es contextual y vacío si no hay selección activa:

| Selección activa                           | Contenido del Rightbar                                                                                                                           |
| --------------------------------------------| --------------------------------------------------------------------------------------------------------------------------------------------------|
| Un `Module` en el grafo o en C4 nivel 3    | Métricas completas del módulo (Ca, Ce, Instabilidad, LCOM4, Índice de Mantenibilidad), lista de imports/importado-por, botón "Ver en Explorador" |
| Un `Antipattern`                           | Severidad, descripción, módulos afectados, sugerencia de refactor de la IA, botón "Ignorar" con campo de justificación                           |
| Una `Dependency` (arista)                  | Tipo de dependencia, peso/fuerza de acoplamiento, módulos origen/destino                                                                         |
| Un elemento de diagrama C4 en modo edición | Propiedades editables: nombre, descripción, tecnología, tipo de elemento                                                                         |
| Nada seleccionado                          | Resumen del proyecto activo: nombre, tipo detectado, estilo detectado, última fecha de análisis                                                  |

> Este panel es el que le da a SAAC la sensación de "herramienta real": cualquier objeto del modelo es inspeccionable sin necesidad de un modal ni de navegar a otra pantalla.

#### 5.1.5 Downbar — Output, Terminal y Problemas

Panel inferior con pestañas, colapsable a una franja mínima. Consolida tres funciones que en la versión original estaban ausentes o implícitas:

| Pestaña | Contenido | Equivalente en IDE |
|---|---|---|
| **Output** | Log en tiempo real del proceso de análisis: "Escaneando filesystem…", "Worker Node.js: 342/342 archivos procesados", "Construyendo AMG…", "IA generando reporte…" | Output Window de Visual Studio |
| **Terminal** | Terminal embebida para ejecutar el CLI de SAAC (`saac analyze`, `saac check`, ver 7.4) sin salir de la app | Terminal integrada de VS Code |
| **Problemas** | Lista consolidada de antipatrones críticos y violaciones de fitness functions (7.3), con severidad y salto directo al elemento afectado | Panel "Errors/Warnings" de cualquier IDE |
| **Historial de Análisis** | Línea de tiempo de `AnalysisRun` ejecutados (3.4), con posibilidad de comparar dos versiones del AMG seleccionadas | — |

#### 5.1.6 Status Bar

Franja fija en la parte inferior, siempre visible incluso con el Downbar colapsado. Muestra estado en tiempo real, sin necesidad de abrir ningún panel:

| Indicador | Ejemplo |
|---|---|
| Estado del último análisis | ● Analizado hace 2 min (verde) / ● Analizando… 67% (ámbar, con barra de progreso) |
| Tamaño del proyecto activo | 342 módulos · 1,847 dependencias |
| Estado de Ollama | 🤖 Ollama: activo (Qwen3 4B) / 🤖 IA: desactivada |
| Consumo de RAM en tiempo real | RAM: 3.1 GB / 8 GB (ver umbrales de 11.3) — se pone en ámbar/rojo si se acerca al límite |
| Fitness Score actual | Fitness: 82/100 clicable, abre el panel de Problemas en el Downbar |
| Rama de git activa (si aplica) | ⎇ main |

### 5.2 Navegación Funcional (dentro del Leftbar)

Las secciones funcionales originales de SAAC se organizan como árbol de navegación dentro de la pestaña "Navegación SAAC" del Leftbar (5.1.3), y determinan qué se renderiza en el canvas central:

| Sección | Ícono | Contenido Principal |
|---|---|---|
| **Dashboard** | 🏠 | Visión general del proyecto: radar chart, métricas clave, resumen IA |
| **Diagramas C4** | 🗺️ | Visualizador interactivo de diagramas C4 con zoom y drill-down |
| **Métricas** | 📊 | Tablas detalladas de todas las métricas por módulo/clase/función |
| **Antipatrones** | ⚠️ | Lista de problemas detectados con severidad y sugerencias |
| **Asistente IA** | 🤖 | Chat contextual con el asistente arquitectónico |
| **Historial** | 📈 | Comparativa temporal: cómo ha evolucionado la arquitectura |
| **Configuración** | ⚙️ | Reglas personalizadas, umbrales, modelo de IA, lenguajes |

### 5.3 Dashboard Principal

#### 5.3.1 Panel de Métricas Clave (parte superior)

Tarjetas con semáforo visual (verde/amarillo/rojo) para las métricas más importantes:

- **Índice de Mantenibilidad global** (0-100): calculado como promedio ponderado de cohesión, acoplamiento y complejidad.
- **Número de antipatrones detectados** con desglose por severidad (crítico/alto/medio/bajo).
- **Cobertura arquitectónica C4:** qué porcentaje del código está representado en los diagramas.
- **Quantum Count:** número de unidades desplegables independientes detectadas.
- **Fitness Score:** puntuación 0-100 basada en el cumplimiento de las reglas arquitectónicas configuradas.

#### 5.3.2 Radar Chart de Características Arquitectónicas

Inspirado en Richards & Ford, el radar chart muestra ocho características arquitectónicas en escala 0-10:

1. **Mantenibilidad:** facilidad de modificar el sistema sin efectos secundarios.
2. **Testabilidad:** facilidad de escribir y ejecutar tests automatizados.
3. **Deployabilidad:** facilidad de desplegar cambios de forma independiente.
4. **Escalabilidad:** capacidad de manejar carga creciente.
5. **Agilidad:** velocidad para implementar nuevas features.
6. **Seguridad:** patrones seguros detectados (ej: no credentials hardcoded, uso de variables de entorno).
7. **Performance:** indicadores de posibles cuellos de botella (N+1 queries, bucles anidados, falta de caché).
8. **Simplicidad:** inversamente proporcional a la complejidad media del sistema.

#### 5.3.3 Grafo de Dependencias Interactivo

Visualización D3.js force-directed del grafo de módulos completo con:

- Nodos coloreados por tipo (controller, service, repository, model, util, etc.)
- Nodos con tamaño proporcional al WMC (complejidad total de la clase).
- Aristas con grosor proporcional al strength del acoplamiento.
- Ciclos resaltados en rojo.
- **Clustering automático:** los módulos fuertemente conectados se agrupan visualmente.
- **Interactividad:** hover para ver métricas del módulo, clic para ver detalles, doble clic para abrir en diagrama C4 nivel 3.

### 5.4 Visualizador C4 Interactivo

El panel de diagramas C4 implementa un visualizador con navegación jerárquica: el usuario comienza en el nivel 1 y hace zoom in (doble clic en cualquier elemento) para ver el siguiente nivel de detalle.

| | |
|---|---|
| **Navegación** | Breadcrumb en la parte superior muestra el nivel actual. Botón "volver" sube un nivel. Permalink URL para cada diagrama. |
| **Layout** | Algoritmos de layout configurables: Dagre (grafos dirigidos), ELK (más sofisticado), Force-Directed (más orgánico). |
| **Anotaciones** | El usuario puede añadir notas en cualquier elemento. Las notas se persisten en un archivo `saac.annotations.json` en el proyecto. |
| **Edición** | Modo edición: permite añadir elementos que el AST no puede inferir (sistemas externos no detectados, contexto de negocio). |
| **Exportación** | PNG a alta resolución, SVG vectorial, Mermaid.js código, PlantUML código, Structurizr DSL. |

#### 5.4.1 Navegación Interactiva y Escalabilidad

Con el objetivo de facilitar la exploración de proyectos de cualquier tamaño, SAAC implementará un modelo de navegación inspirado en aplicaciones cartográficas, permitiendo recorrer la arquitectura de forma progresiva sin sobrecargar al usuario con toda la información simultáneamente.

**Navegación Interactiva (Zoom y Drill-down)**

La experiencia de navegación funcionará como un *"Google Maps para el código"*. El usuario comenzará explorando el Mapa del Paisaje del Sistema (System Landscape) y, mediante acciones de zoom, doble clic o drill-down, podrá navegar sucesivamente hacia:

1. Contexto del Sistema.
2. Contenedores.
3. Componentes.
4. Código.
5. Elementos internos (clases, funciones y relaciones).

Cada transición reutilizará el mismo AMG, mostrando únicamente el nivel de detalle correspondiente sin necesidad de regenerar el modelo arquitectónico.

**Manejo de Complejidad (Scaling)**

Para mantener la claridad visual en proyectos de gran tamaño, SAAC incorporará diversas estrategias de reducción de complejidad:

- **Filtrado por Proximidad:** cuando un diagrama contenga cientos o miles de elementos, el usuario podrá seleccionar cualquier componente y visualizar únicamente su entorno inmediato (dependencias directas entrantes/salientes, componentes relacionados a uno o varios niveles de profundidad, rutas mínimas entre componentes seleccionados).
- **Resumen por Brevedad:** los componentes transversales o de infraestructura que aparezcan repetidamente (Logging, Auditoría, Autenticación, Configuración, Observabilidad, Manejo de Errores) podrán ocultarse automáticamente, añadiendo una anotación como *"Todos los componentes utilizan el módulo de Logging (no mostrado por brevedad)"*.

### 5.5 Panel de Métricas Detalladas

Tabla TanStack Table con todas las métricas organizadas en tres vistas:

- **Vista por Módulo:** cada fila es un módulo/archivo con todas sus métricas como columnas.
- **Vista por Clase:** desglosa dentro de cada módulo por clase, con métricas OOP (WMC, DIT, NOC, LCOM4, RFC, CBO).
- **Vista por Función:** desglosa por función con CC, LOC, número de parámetros, complejidad cognitiva.

**Funcionalidades de la tabla:** ordenación por cualquier métrica; filtros (mostrar solo módulos en "zona de dolor", solo los que violan umbrales configurados, etc.); exportación CSV y JSON; heatmap condicional (celdas coloreadas por umbrales verde/amarillo/rojo).

### 5.6 Panel de Antipatrones

Lista de problemas detectados con:

- Severidad (Crítico / Alto / Medio / Bajo / Informativo) con código de color.
- Tipo de antipatrón con descripción del porqué es problemático.
- Módulos afectados con links directos para abrirlos en el grafo.
- Sugerencia de refactoring generada por la IA.
- Botón "Ignorar": permite marcar un antipatrón como intencional, con campo de justificación que se guarda en `saac.annotations.json`.
- Filtros por tipo, severidad, módulo afectado.

### 5.7 Asistente IA — Chat

Interfaz de chat estándar con burbujas de mensaje, historial de la sesión y las siguientes capacidades especiales:

- **Referencias contextuales:** la IA puede mencionar módulos específicos del proyecto y el chat los convierte en links clickables que abren el módulo en el grafo.
- **Comandos especiales:** `/diagram [nombre]` genera un diagrama específico, `/metrics [módulo]` muestra métricas de un módulo, `/explain [antipatrón]` explica detalladamente un problema.
- **Modo offline visible:** indicador claro de que la IA corre localmente.
- **Indicador de modelo activo:** muestra qué modelo está corriendo (Qwen3 4B, Phi-4 Mini, etc.).
- **Exportación del chat:** guardar conversación como Markdown.

---

## 6. Especificación Técnica

### 6.1 Estructura de Carpetas del Proyecto SAAC

```
saac/
├── src-tauri/                  # Backend Rust (Tauri core)
│   ├── src/
│   │   ├── main.rs             # Entry point Tauri
│   │   ├── commands/           # Comandos IPC expuestos al frontend
│   │   │   ├── analysis.rs     # Comandos de análisis
│   │   │   ├── project.rs      # Comandos de proyecto
│   │   │   └── ai.rs           # Comandos de IA / Ollama
│   │   ├── engine/              # Lógica de negocio
│   │   │   ├── project_detector.rs
│   │   │   ├── amg.rs           # Architecture Model Graph
│   │   │   ├── cache.rs         # sled-based cache
│   │   │   └── aggregator.rs    # Agrega resultados de workers
│   │   ├── workers/              # Gestión de procesos hijo
│   │   │   ├── node_worker.rs    # Spawner Node.js
│   │   │   └── python_worker.rs  # Spawner Python
│   │   └── ollama/               # Cliente HTTP para Ollama
│   └── Cargo.toml
├── src/                        # Frontend React + TypeScript
│   ├── components/
│   │   ├── dashboard/           # Componentes del dashboard
│   │   ├── c4/                  # Visualizador C4
│   │   ├── metrics/              # Tablas de métricas
│   │   ├── antipatterns/         # Panel de antipatrones
│   │   └── ai-chat/               # Interfaz del chat
│   ├── stores/                  # Estado global Zustand
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilidades y helpers
│   └── types/                   # TypeScript types compartidos
├── workers/
│   ├── node/                    # Worker Node.js
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point (lee stdin, escribe stdout)
│   │   │   ├── parsers/          # Parsers por lenguaje
│   │   │   │   ├── typescript.ts
│   │   │   │   └── javascript.ts
│   │   │   ├── metrics/          # Calculadores de métricas
│   │   │   └── extractors/       # Extractores de patrones
│   │   └── package.json
│   └── python/                  # Worker Python
│       ├── main.py               # Entry point
│       ├── parsers/               # Parsers tree-sitter por lenguaje
│       ├── metrics/                # Calculadores LCOM, CC, etc.
│       ├── patterns/               # Detectores de patrones y smells
│       └── exporters/              # Exportadores C4, PlantUML, Mermaid
├── shared/                      # Tipos JSON compartidos entre capas
│   └── types.ts                 # AMG schema, métricas, etc.
└── package.json                 # Frontend dependencies
```

### 6.2 Modelo de Datos — Architecture Model Graph (AMG)

El esquema completo del AMG (nodos, aristas, dominio, versionado, plugins) se define en el **Capítulo 3 — Architecture Model Graph (AMG)**, que es la referencia normativa. Esta sección solo señala dónde vive físicamente cada pieza dentro del código fuente:

| Elemento del AMG (Cap. 3) | Ubicación en el código |
|---|---|
| `ArchitectureModelGraph`, `Module`, `ModuleMetrics`, `AMGDelta` (esquema TypeScript, 3.5) | `shared/types.ts` |
| Construcción y agregación del AMG desde los workers | `src-tauri/src/engine/amg.rs` |
| Persistencia de snapshots y deltas (3.4.3) | `src-tauri/src/engine/cache.rs` sobre `sled` |
| Contrato de plugins (`SaacPlugin`, 3.6.2) | `src-tauri/src/engine/plugins/` (interno en v1.0) |

### 6.3 Protocolo de Comunicación entre Capas

Todas las capas se comunican mediante JSON sobre diferentes canales:

| Origen → Destino | Canal | Formato | Nota |
|---|---|---|---|
| Frontend → Rust | Tauri IPC `invoke()` | TypeScript → Rust `serde` JSON | Tipado en ambos extremos |
| Rust → Node.js Worker | stdin/stdout pipes | JSON Lines (un JSON por línea) | Proceso spawn con Tokio |
| Rust → Python Worker | stdin/stdout pipes | JSON Lines | Misma arquitectura |
| Rust → Ollama | HTTP POST `localhost:11434` | Ollama API JSON | Non-streaming por defecto |
| Rust → Frontend (eventos) | Tauri `emit_all()` | JSON eventos tipados | Progreso en tiempo real |

### 6.4 Dependencias Completas del Proyecto

#### 6.4.1 Frontend (`package.json`)

| Paquete | Versión | Propósito |
|---|---|---|
| `react` | 18.x | Framework UI |
| `typescript` | 5.x | Type safety |
| `vite` | 5.x | Build tool y dev server |
| `zustand` | 4.x | Estado global |
| `@xyflow/react` (ReactFlow) | 12.x | Visualización de grafos y diagramas C4 |
| `d3` | 7.x | Visualizaciones custom (radar chart, treemap) |
| `mermaid` | 10.x | Renderizado de diagramas Mermaid |
| `@tanstack/react-table` | 8.x | Tablas de métricas |
| `tailwindcss` | 3.x | Estilos utility-first |
| `@radix-ui/react-*` | latest | Componentes accesibles (dialogs, tabs, etc.) |
| `recharts` | 2.x | Charts simples (barras, líneas) |
| `@tauri-apps/api` | 2.x | SDK Tauri para el frontend |
| `lucide-react` | latest | Iconografía consistente |
| `cmdk` | latest | Command palette (búsqueda rápida) |
| `date-fns` | 3.x | Manipulación de fechas en historial |

#### 6.4.2 Node.js Worker (`workers/node/package.json`)

| Paquete | Versión | Propósito |
|---|---|---|
| `@typescript-eslint/parser` | 7.x | Parser AST TypeScript/JavaScript |
| `typescript` | 5.x | TypeScript Compiler API |
| `@babel/parser` | 7.x | Parser alternativo para JS legacy |
| `acorn` | 8.x | Parser JS estándar ECMAScript |
| `acorn-walk` | 8.x | Walker del AST de acorn |
| `resolve` | 1.x | Resolución de módulos Node.js |
| `glob` | 10.x | Glob patterns para escanear archivos |

#### 6.4.3 Python Worker (`requirements.txt`)

| Paquete | Versión | Propósito |
|---|---|---|
| `tree-sitter` | 0.22+ | Motor de parsing multi-lenguaje |
| `tree-sitter-python` | latest | Gramática Python |
| `tree-sitter-java` | latest | Gramática Java |
| `tree-sitter-kotlin` | latest | Gramática Kotlin |
| `tree-sitter-c-sharp` | latest | Gramática C# |
| `tree-sitter-swift` | latest | Gramática Swift |
| `tree-sitter-go` | latest | Gramática Go |
| `tree-sitter-rust` | latest | Gramática Rust |
| `networkx` | 3.x | Algoritmos de grafos (ciclos, componentes conectados, etc.) |
| `pygments` | 2.x | Tokenización para lenguajes sin gramática tree-sitter |
| `jinja2` | 3.x | Templates para generación de PlantUML y Mermaid |

#### 6.4.4 Rust (`Cargo.toml`)

| Crate | Propósito |
|---|---|
| `tauri` (2.x) | Framework desktop principal |
| `tokio` | Runtime async para gestión de procesos |
| `serde` / `serde_json` | Serialización JSON |
| `sled` | Cache persistente embebida |
| `reqwest` | HTTP client para Ollama API |
| `walkdir` | Escaneo recursivo del filesystem |
| `ignore` | Respeto de `.gitignore` en el escaneo |
| `sha2` | Hash SHA256 para cache invalidation |
| `anyhow` | Gestión de errores ergonómica |
| `tracing` | Logging estructurado |

---

## 7. Sistema de Reglas Arquitectónicas — Fitness Functions

### 7.1 Concepto

Inspirado en *"Fundamentals of Software Architecture"* (Richards & Ford), SAAC implementa **fitness functions**: reglas automáticas que definen qué hace que la arquitectura sea "buena" para este proyecto específico. Se definen en un archivo `.saac/rules.yaml` en el repositorio del proyecto analizado.

> ### ¿Por qué fitness functions?
>
> *"Una función de aptitud arquitectónica es cualquier mecanismo que proporcione una evaluación objetiva de una característica arquitectónica."* — Richards & Ford. En SAAC, estas funciones se ejecutan sobre el AMG y producen un score que puede integrarse en el pipeline CI/CD.

### 7.2 Formato del Archivo de Reglas

```yaml
# .saac/rules.yaml
version: "1.0"

# Umbrales de métricas
thresholds:
  coupling:
    max_efferent: 10      # Ce máximo por módulo
    max_afferent: 20      # Ca máximo (God Module)
    max_cbo: 7             # CBO máximo por clase
  cohesion:
    max_lcom4: 2            # LCOM4 máximo (>1 = candidato a dividir)
    min_tcc: 0.3             # TCC mínimo
  complexity:
    max_cyclomatic: 10        # CC máximo por función
    max_cognitive: 15          # Complejidad cognitiva máxima
    max_loc_function: 40        # LOC máximo por función
    max_wmc: 50                  # WMC máximo por clase
  maintainability:
    min_index: 65                 # Índice de mantenibilidad mínimo (0-100)
    max_distance: 0.3              # Distancia de secuencia principal máxima

# Reglas de dependencia entre capas
dependency_rules:
  - name: "No UI → Data directo"
    forbidden:
      from_pattern: "*/components/*"
      to_pattern: "*/repositories/*"
    severity: critical
  - name: "Domain no depende de Infrastructure"
    forbidden:
      from_pattern: "*/domain/*"
      to_pattern: "*/infrastructure/*"
    severity: critical
  - name: "No circular entre features"
    type: no_cycles
    scope: "*/features/*"
    severity: high

# Configuración de la IA
ai:
  model: "qwen3:4b"       # Modelo Ollama a usar
  enabled: true
  auto_analyze: true       # Analiza automáticamente al abrir

# Módulos a ignorar en el análisis
ignore:
  - "**/__tests__/**"
  - "**/*.spec.ts"
  - "**/node_modules/**"
  - "**/dist/**"
```

### 7.3 Evaluación de Reglas y Scoring

Cada regla se evalúa contra el AMG y produce:

- **Status:** PASS / FAIL / WARNING
- **Elementos afectados:** lista de módulos/clases que violan la regla.
- **Severidad:** determina el peso en el Fitness Score global.
- **Mensaje:** descripción human-readable del problema.

El **Fitness Score global** (0-100) se calcula como:

- 100 puntos base.
- **-20 puntos** por cada violación `CRITICAL`.
- **-10 puntos** por cada violación `HIGH`.
- **-5 puntos** por cada violación `MEDIUM`.
- **-2 puntos** por cada violación `LOW`.
- Mínimo: 0.

### 7.4 Integración CI/CD

SAAC incluye un modo CLI para ejecutarse en pipelines de integración continua:

```bash
# Instalación del CLI
npm install -g saac-cli

# Análisis con salida JSON (para parsing en CI)
saac analyze ./mi-proyecto --output json > saac-report.json

# Verificar reglas (exit code 1 si hay violaciones críticas)
saac check ./mi-proyecto --fail-on critical

# GitHub Actions ejemplo
- name: SAAC Architecture Check
  run: saac check . --fail-on critical --report-format github
```

El modo CI opera sin interfaz gráfica ni Ollama (análisis puro AST + métricas). El reporte JSON es consumible por herramientas de quality gates.

---

## 8. Plan de Desarrollo — Roadmap

### 8.1 Fases del Proyecto

El desarrollo se divide en cuatro fases, cada una entregando valor funcional independiente:

#### 🚀 Fase 1 — Fundamentos (Semanas 1-6)

**Objetivo:** Tener un prototipo funcional que escanea un proyecto TypeScript/Node.js, genera el grafo de dependencias y lo muestra en pantalla.

| Semana | Tarea | Entregable |
|---|---|---|
| 1-2 | Setup del proyecto Tauri + React + TS. Estructura de carpetas. CI/CD base. | Proyecto arranca. Hot reload funcional. |
| 2-3 | Worker Node.js: parser TypeScript AST. Extracción de imports y exports. | JSON con grafo de dependencias de proyecto TS. |
| 3-4 | Backend Rust: spawner de workers. Protocolo JSON Lines. Cache con sled. | Rust orquesta al worker Node.js correctamente. |
| 4-5 | Frontend: visualizador básico de grafo D3.js/ReactFlow. Panel de módulos. | Grafo de dependencias interactivo visible. |
| 5-6 | Cálculo de métricas básicas (Ca, Ce, Instabilidad, CC). Dashboard básico. | Métricas visibles por módulo en la UI. |

#### 📊 Fase 2 — Diagramas C4 y Métricas Avanzadas (Semanas 7-14)

**Objetivo:** Generación automática de diagramas C4 niveles 1-3, métricas completas (LCOM4, Abstractness, Distance) y detección básica de antipatrones.

| Semana | Tarea | Entregable |
|---|---|---|
| 7-8 | Algoritmo de generación C4 Nivel 1 y 2 desde el AMG. | Diagramas de contexto y contenedores automáticos. |
| 8-9 | C4 Nivel 3 (componentes). Layout con Dagre. Exportación SVG/PNG. | Drill-down funcional en los diagramas C4. |
| 9-10 | Métricas LCOM4, TCC, Abstractness, Distance. Radar chart. | Todas las métricas de Richards & Ford implementadas. |
| 10-11 | Detector de antipatrones: ciclos, God Module, violación de capas. | Panel de antipatrones con al menos 5 tipos. |
| 11-12 | Worker Python: tree-sitter para Python y Java. Integración con AMG. | Análisis de proyectos Python y Java. |
| 12-14 | Detector de estilo arquitectónico. Clasificador de framework. | El sistema identifica Layered, Hexagonal, Microservicios. |

#### 🤖 Fase 3 — IA Local y Lenguajes Adicionales (Semanas 15-20)

**Objetivo:** Integración completa del asistente IA local vía Ollama. Soporte para Kotlin, C#, Go, Rust y Swift.

| Semana | Tarea | Entregable |
|---|---|---|
| 15-16 | Integración Ollama: cliente HTTP Rust. Análisis automático al abrir proyecto. | IA genera reporte narrativo del proyecto. |
| 16-17 | Chat contextual con el AMG como contexto. Comandos especiales. | Chat funcional con referencias a módulos. |
| 17-18 | Soporte Kotlin y C# en worker Python (tree-sitter). | Proyectos Android y .NET analizables. |
| 18-19 | Soporte Go y Rust. Detección de proyectos móviles (Flutter, React Native). | Cobertura de lenguajes completa. |
| 19-20 | Sistema de reglas `.saac/rules.yaml`. Fitness Score. Generación de ADRs. | Fitness functions configurables y evaluadas. |

#### ✨ Fase 4 — Historial, CLI y Pulido (Semanas 21-28)

**Objetivo:** Análisis temporal con historial git, modo CLI para CI/CD, exportación Structurizr DSL, onboarding y documentación completa.

| Semana | Tarea | Entregable |
|---|---|---|
| 21-22 | Integración git: análisis histórico por commit. Gráficas de evolución. | Vista de cómo la arquitectura ha cambiado. |
| 22-23 | CLI SAAC para CI/CD. Modos JSON y GitHub annotations output. | `saac check` funcional en GitHub Actions. |
| 23-24 | Exportación Structurizr DSL completa. Modo edición en diagramas C4. | Compatibilidad total con ecosistema C4. |
| 24-26 | Testing exhaustivo. Performance para proyectos grandes (>100k LOC). | Análisis de monorepos en <30 segundos. |
| 26-28 | Onboarding wizard. Documentación in-app. Instaladores para Win/Mac/Linux. | Versión 1.0 lista para distribución. |

### 8.2 Stack de Herramientas de Desarrollo

| Categoría | Herramientas |
|---|---|
| **Control de versiones** | Git + GitHub / GitLab con conventional commits |
| **CI/CD** | GitHub Actions: test, build, release para Win/Mac/Linux |
| **Testing Frontend** | Vitest + React Testing Library + Playwright (E2E) |
| **Testing Rust** | `cargo test` + `cargo nextest` |
| **Testing Workers** | Jest (Node.js) + pytest (Python) |
| **Linting** | ESLint + Prettier (TS), clippy (Rust), ruff (Python) |
| **Build desktop** | `tauri build` (produce .exe, .dmg, .AppImage automáticamente) |
| **Documentación** | VitePress para docs técnica, JSDoc/TSDoc para API |

---

## 9. Casos de Uso Detallados

### CU-001: Análisis de Proyecto TypeScript/React Existente

| Campo | Descripción |
|---|---|
| **Actor principal** | Arquitecto de Software / Tech Lead |
| **Precondición** | El proyecto tiene un `package.json` y estructura de directorios estándar |
| **Trigger** | El usuario abre SAAC y selecciona la carpeta del proyecto |
| **Flujo principal** | 1. SAAC detecta framework: React 18 + Vite + TypeScript 2. Escanea 342 archivos .ts y .tsx en 4.2 segundos 3. Construye AMG con 342 nodos y 1,847 dependencias 4. Detecta estilo: Layered Architecture con 73% de confianza 5. Calcula métricas: 12 módulos en zona de dolor, 3 antipatrones críticos 6. Genera diagramas C4 niveles 1-3 automáticamente 7. IA genera reporte narrativo en 18 segundos |
| **Postcondición** | Dashboard completo visible. AMG cacheado para análisis incrementales futuros. |
| **Flujo alternativo** | Si `tsconfig.json` no existe, SAAC usa configuración por defecto y lo notifica. |

### CU-002: Detección de Deuda Arquitectónica en Proyecto Legacy

| Campo | Descripción |
|---|---|
| **Actor principal** | Consultor de Software |
| **Precondición** | Proyecto Java Spring Boot de 5 años con 80,000 LOC |
| **Trigger** | Cliente solicita auditoría arquitectónica |
| **Flujo principal** | 1. SAAC analiza el proyecto en ~45 segundos 2. Detecta estilo: "Big Ball of Mud con características Layered parciales" (61% confianza) 3. Identifica 23 dependencias cíclicas entre módulos 4. Detecta 4 God Classes con Ce > 20 5. Calcula: Instabilidad media 0.73 (altamente inestable), Distance media 0.61 (zona de dolor) 6. IA genera lista priorizada de refactoring con estimaciones de impacto |
| **Postcondición** | Reporte PDF exportado con métricas, diagramas C4 y plan de refactoring priorizado. |

### CU-003: Onboarding de Nuevo Desarrollador

| Campo | Descripción |
|---|---|
| **Actor principal** | Desarrollador Junior recién incorporado |
| **Precondición** | Proyecto de microservicios con 8 servicios en diferentes lenguajes |
| **Trigger** | Tech Lead comparte archivo `saac-model.json` del sistema completo |
| **Flujo principal** | 1. Dev carga el modelo exportado en SAAC 2. Navega el diagrama de contexto (nivel 1): entiende el sistema completo 3. Hace zoom en el servicio al que se incorporará (nivel 2) 4. Explora los componentes del servicio (nivel 3) 5. Pregunta al chat de IA: "¿Cuál es la responsabilidad del OrderService y de qué depende?" 6. IA responde con contexto específico del proyecto: "OrderService gestiona el ciclo de vida de pedidos. Depende de InventoryClient (HTTP), PaymentClient (HTTP) y OrderRepository (PostgreSQL). Su principal punto de acoplamiento es..." |
| **Postcondición** | Dev entiende la arquitectura del servicio en 20 minutos vs. las 2-3 horas típicas de lectura de código. |

### CU-004: Verificación Continua en CI/CD

| Campo | Descripción |
|---|---|
| **Actor principal** | Pipeline de GitHub Actions (automatizado) |
| **Precondición** | `.saac/rules.yaml` configurado con reglas del equipo |
| **Trigger** | Pull Request abierta con cambios en la arquitectura |
| **Flujo principal** | 1. `saac check . --fail-on critical` ejecuta sin UI 2. Detecta que el PR introduce una dependencia `domain/` → `infrastructure/` 3. Genera anotación directamente en el diff de GitHub: "Línea 12: Viola regla Domain no depende de Infrastructure. El dominio debe depender de abstracciones, no de implementaciones concretas." 4. El pipeline falla con exit code 1 5. El PR no puede ser mergeado hasta que se corrija la violación |
| **Postcondición** | La arquitectura se protege automáticamente en cada PR. Zero degradación arquitectónica involuntaria. |

---

## 10. Requisitos No Funcionales

> Los requisitos no funcionales (RNF) aparecían dispersos e implícitos en distintas secciones del documento (gestión de RAM en 11.3, tiempos de análisis en los casos de uso del capítulo 9, límites de proyecto en 11.1). Este capítulo los consolida en una única tabla de referencia, agrupada por categoría, para que sirvan como criterio de aceptación verificable durante el desarrollo y el testing (8.2).

### 10.1 Rendimiento

| ID | Requisito | Valor objetivo | Verificado en |
|---|---|---|---|
| RNF-01 | Tiempo de análisis completo — proyecto pequeño (<500 archivos) | < 10 segundos | CU-001 (9): 342 archivos en 4.2s |
| RNF-02 | Tiempo de análisis completo — proyecto mediano (~80k LOC) | < 60 segundos | CU-002 (9): ~45s |
| RNF-03 | Tiempo de análisis completo — proyecto grande (>100k LOC) | < 30 segundos (con cache incremental activo) | 8.1, Fase 4, semanas 24-26 |
| RNF-04 | Tiempo de generación de reporte narrativo de IA | < 20 segundos con Qwen3 4B en CPU | CU-001 (9): 18s |
| RNF-05 | Tiempo de respuesta del chat IA contextual | < 8 segundos por respuesta (500 tokens máx.) | 4.7.2 |
| RNF-06 | Tiempo de re-análisis incremental (solo archivos modificados) | < 5 segundos para <20 archivos modificados | 3.4.3 (Delta incremental) |
| RNF-07 | Tiempo de renderizado de diagrama C4 (cualquier nivel) | < 2 segundos tras cambio de vista | 5.3 |

### 10.2 Escalabilidad y Límites de Capacidad

| ID | Requisito | Valor objetivo |
|---|---|---|
| RNF-08 | Tamaño máximo de proyecto soportado (v1.0) | 200,000 LOC por análisis completo |
| RNF-09 | Número máximo de nodos en el AMG sin degradar interactividad del grafo | 5,000 nodos (Module + ClassInfo + FunctionInfo) |
| RNF-10 | Número máximo de aristas (Dependency) renderizadas simultáneamente | 15,000 aristas, con clustering automático por encima de este umbral |
| RNF-11 | Historial de análisis retenido por proyecto | 100 AnalysisRun o 90 días, lo que ocurra primero (3.4.3) |
| RNF-12 | Lenguajes soportados simultáneamente en un monorepo | 8 (1.4), sin límite artificial adicional |

### 10.3 Consumo de Recursos

| ID | Requisito | Valor objetivo | Detalle |
|---|---|---|---|
| RNF-13 | RAM en reposo (SAAC + Ollama cargado) | 2.6 – 3.6 GB | 11.3 |
| RNF-14 | RAM durante análisis activo (todos los procesos) | 3 – 4.5 GB | 11.3 |
| RNF-15 | RAM mínima recomendada del equipo host | 8 GB | 11.3 |
| RNF-16 | CPU: análisis no debe bloquear la UI | Workers en procesos separados; frontend permanece responsive (60 fps en interacciones) | 2.2, Capas 3-4 |
| RNF-17 | Espacio en disco para cache (sled) | < 500 MB para un proyecto de 200k LOC con historial completo | 3.4.3 |
| RNF-18 | Tamaño del instalador | < 10 MB (Tauri) | Decisión Arquitectónica #001 |

### 10.4 Disponibilidad y Confiabilidad

| ID | Requisito | Valor objetivo |
|---|---|---|
| RNF-19 | Disponibilidad de la app | 100% offline-first; ninguna función core depende de conectividad a internet |
| RNF-20 | Degradación ante fallo de Ollama | La app continúa operando en "modo sin IA" (métricas y diagramas intactos) |
| RNF-21 | Degradación ante gramática tree-sitter incompleta | Fallback a análisis de imports por regex, con indicador de confianza reducido |
| RNF-22 | Integridad del AMG ante cierre inesperado | Snapshot/delta más reciente persistido en sled antes de cada escritura; sin pérdida de historial |

### 10.5 Seguridad y Privacidad

| ID     | Requisito                                 | Valor objetivo                                                                                                                                  |
| --------| -------------------------------------------| -------------------------------------------------------------------------------------------------------------------------------------------------|
| RNF-23 | Código fuente del proyecto analizado      | Nunca sale de la máquina local (1.1); ni siquiera hacia Ollama, que recibe solo el AMG resumido                                                 |
| RNF-24 | Comunicación con Ollama                   | Exclusivamente `localhost:11434`, sin llamadas salientes a internet salvo que el usuario configure explícitamente un `AIPlugin` externo (3.6.1) |
| RNF-25 | Datos de anotaciones y reglas del usuario | Persistidos solo en el filesystem del proyecto (`saac.annotations.json`, `.saac/rules.yaml`), nunca sincronizados a un servidor                 |

### 10.6 Usabilidad y Portabilidad

| ID | Requisito | Valor objetivo |
|---|---|---|
| RNF-26 | Plataformas de escritorio soportadas | Windows, macOS, Linux (instaladores nativos vía `tauri build`, 8.2) |
| RNF-27 | Tiempo de onboarding para un desarrollador nuevo en un proyecto ya analizado | < 20 minutos vs. 2-3 horas de lectura manual de código (CU-003, 9) |
| RNF-28 | Accesibilidad de componentes UI | Cumplimiento de estándares WAI-ARIA vía Radix UI (2.2, Capa 1) |

---

## 11. Limitaciones, Riesgos y Mitigaciones

### 11.1 Limitaciones Técnicas Conocidas

| Limitación | Impacto | Mitigación |
|---|---|---|
| Análisis estático no captura comportamiento runtime | Dependencias en colas de mensajes y eventos async no detectadas | Soporte opcional de OpenTelemetry traces como fuente adicional (v2.0) |
| Lenguajes dinámicos: tipado impreciso | Python/JS sin type hints: tipos inferidos pueden ser incorrectos | Indicador de confianza por módulo. Priorizar proyectos con MyPy/TypeScript strict |
| IA de 4B params: razonamiento limitado | No puede analizar trade-offs arquitectónicos complejos | IA como ayudante de primer nivel. Opción de conectar API externa (Claude, GPT) para análisis profundo |
| Proyectos >200k LOC: lentitud | Análisis completo puede tardar >60 segundos | Análisis incremental por cambios git. Worker pool paralelo. Indicador de progreso en tiempo real |
| Monorepos multi-lenguaje complejos | Relaciones entre servicios en diferentes lenguajes difíciles de resolver | Configuración manual de boundaries en `.saac/config.yaml` |
| Sin análisis de seguridad profundo | No detecta vulnerabilidades de seguridad específicas | Integración planificada con Semgrep para v2.0 |

### 11.2 Riesgos del Proyecto y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| tree-sitter: gramáticas incompletas para algunos lenguajes | Media | Alto | Fallback a análisis de imports por texto (regex) con menor precisión |
| Ollama cambia su API | Baja | Medio | Capa de abstracción sobre la API de Ollama. Tests de integración |
| WebView inconsistencias entre OS (problema Tauri) | Media | Medio | Testing E2E en Win/Mac/Linux en CI. Polyfills CSS donde sea necesario |
| Proyectos con arquitecturas muy atípicas | Media | Medio | Modo "sin clasificación": mostrar métricas sin asignar estilo |
| Memoria RAM: IA + análisis + app en 8GB | Alta | Alto | Análisis y IA no corren en paralelo. Análisis termina → IA carga. Monitorización de RAM en tiempo real |

### 11.3 Gestión de RAM en Equipos con 8GB

> Este es el riesgo más importante. La estrategia de gestión de memoria:

- **SAAC** (frontend + Tauri): ~50-80 MB RAM
- **Worker Node.js** (solo durante análisis): ~200-400 MB temporal, se cierra al terminar
- **Worker Python** (solo durante análisis): ~150-300 MB temporal, se cierra al terminar
- **Ollama con Qwen3 4B Q4_K_M:** ~2.5 GB RAM
- **Sistema operativo + otras apps:** ~2-3 GB

| Escenario | Consumo total |
|---|---|
| **Total en reposo** (post-análisis) | ~2.6-3.6 GB (SAAC + Ollama) |
| **Total durante análisis** | ~3-4.5 GB (todos los procesos activos simultáneamente) |

**Estrategia de Optimización RAM:** los workers se spawnan solo cuando hay análisis en curso y se terminan al completarse (SIGTERM). Ollama solo se lanza cuando el usuario activa el asistente IA (no al abrir la app). En equipos con <6GB libres, SAAC muestra un aviso y sugiere cerrar otras aplicaciones o usar el modo sin IA.

---

## 12. Referencias Bibliográficas y Técnicas

### 12.1 Libros Base

| Obra | Detalle |
|---|---|
| **Fundamentals of Software Architecture, 2nd Ed.** | Mark Richards & Neal Ford. O'Reilly, 2025. ISBN: 978-1-098-17551-1. Fuente de: estilos arquitectónicos, métricas (cohesión, acoplamiento, abstractness, instabilidad, distance), características arquitectónicas (fitness functions), quantum arquitectónico, connascence. |
| **The C4 Model: Visualizing Software Architecture** | Simon Brown. O'Reilly, 2024. Fuente de: los cuatro niveles de diagramas (Context, Container, Component, Code), diagramas suplementarios (System Landscape, Dynamic, Deployment), filosofía de "diagramas como código", Structurizr DSL. |

### 12.2 Métricas Académicas Implementadas

| Métrica | Referencia |
|---|---|
| LCOM4 | Hitz M. & Montazeri B. (1995). *Measuring Coupling and Cohesion In Object-Oriented Systems.* University of Vienna. |
| TCC / LCC | Bieman J. & Kang B. (1995). *Cohesion and Reuse in an Object-Oriented System.* ACM SIGSOFT. |
| CBO / RFC / WMC / DIT / NOC | Chidamber S. & Kemerer C. (1994). *A Metrics Suite for Object Oriented Design.* IEEE Transactions on Software Engineering. |
| Abstractness & Distance | Martin R.C. (1994). *OO Design Quality Metrics: An Analysis of Dependencies.* OOPSLA Workshop. |
| Complejidad Cognitiva | Campbell G.A. (2018). *Cognitive Complexity: A new way of measuring understandability.* SonarSource SA. |

### 12.3 Herramientas y Tecnologías de Referencia

| Herramienta | Detalle |
|---|---|
| **Structurizr** | structurizr.com — Herramienta de referencia de Simon Brown para C4 as code. SAAC es compatible con su DSL. |
| **Structure101** | structure101.com — Referencia comercial de análisis arquitectónico. SAAC aspira a ser su alternativa open-source. |
| **ast-metrics** | github.com/Halleck45/ast-metrics — Inspiración para el enfoque multi-métrica sobre AST. |
| **tree-sitter** | tree-sitter.github.io — Motor de parsing incremental multi-lenguaje. Motor central del worker Python. |
| **Ollama** | ollama.com — Runtime de modelos LLM locales. Capa de IA de SAAC. |
| **Tauri v2** | tauri.app — Framework desktop. Core de SAAC. |
| **ReactFlow / XYFlow** | reactflow.dev — Librería de visualización de grafos. Motor de diagramas C4. |

### 12.4 Modelos de IA Compatibles (vía Ollama)

| Modelo | RAM Requerida | Velocidad (CPU) | Recomendado Para |
|---|---|---|---|
| **Qwen3 4B Q4_K_M** | ~2.5 GB | ~15-20 tok/s | Opción primaria: mejor coding en <5B params (2026) |
| **Qwen3.5 4B Q4_K_M** | ~2.5 GB | ~12-18 tok/s | Alternativa: multimodal, contexto 256K |
| **Phi-4 Mini 3.8B Q4_K_M** | ~2.2 GB | ~20-25 tok/s | Más rápido, menos orientado a código |
| **Llama 3.2 3B Q4_K_M** | ~2.0 GB | ~25-30 tok/s | El más rápido, calidad menor |
| **Qwen2.5-Coder 7B Q4_K_M** | ~4.5 GB | ~8-12 tok/s | Mejor calidad, requiere >5.5GB libres |
| **DeepSeek-R1 7B Q4_K_M** | ~4.5 GB | ~6-10 tok/s | Mejor razonamiento, requiere >5.5GB libres |

---

<div align="center">

**SAAC — Sistema de Análisis de Arquitectura de Código**

*Documento de Especificación Técnica v2.0 — 2026*

Basado en *Fundamentos de Arquitectura de Software 2ª Ed.* (Richards & Ford) y el *Modelo C4* (Simon Brown)

Fusión de especificaciones v1.0 y v1.1 para una cobertura completa y refinada.

</div>
