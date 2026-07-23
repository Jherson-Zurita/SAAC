# Plan de Implementación — Frontend Completo de SAAC v2.0

Este plan cubre la construcción completa del frontend (React + TypeScript + Vite) descrito en §5-§6 de la especificación técnica, conectado contra el backend Rust real ya implementado y verificado con tests E2E (motor AMG, antipatrones, C4 completo, diagramas suplementarios, IA local).

> **Principio rector**: cada pantalla de este plan se construye contra un comando Tauri que **ya existe y ya está probado**. Ninguna pantalla del plan depende de datos que el backend no produce todavía (ver §0.3, "Brechas conocidas").

---

## 0. Punto de partida — Qué existe hoy

### 0.1 Comandos Tauri disponibles (backend real, verificado)

| Comando | Firma (simplificada) | Devuelve |
|---|---|---|
| `analyze_project` | `(path: string) -> ProjectAnalysisResult` | `{ totalFiles, successful, failed, skipped, outcomes[], skippedFiles[], durationMs, cancelled, amg: ArchitectureModelGraph \| null }` |
| `cancel_analysis` | `() -> boolean` | `true` si había un análisis en curso al que señalizar |
| `analyze_file` | `(filePath, language, fileHash) -> FileAnalysisOutcome` | Resultado de un único archivo |
| `analyze_files` | `(filePaths: string[]) -> FileAnalysisOutcome[]` | Batch sin chunking/progreso (usado por Nivel 4 bajo demanda, ver 0.2) |
| `check_ai_status` | `(config?: AiConfig) -> AiStatusResult` | `{ isOnline, provider, endpointUrl, availableModels[], message }` |
| `ask_ai` | `(prompt, contextType?, targetId?, config?, amg?) -> AiResponse` | `{ content, modelUsed, providerUsed, promptTokens, completionTokens, isMockFallback, generatedPrompt }` |
| `greet` | — | Comando de ejemplo del template de Tauri, sin uso funcional |

### 0.2 Eventos Tauri emitidos durante `analyze_project`

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `project://progress` | `{ phase: "scanning"\|"analyzing"\|"done"\|"cancelled", totalFiles, completedFiles, nodeFiles, pythonFiles, skippedFiles, currentFile }` | Al iniciar el escaneo, tras cada chunk procesado, y al finalizar/cancelar |

### 0.3 Brechas conocidas entre la especificación y el backend real

Estas son diferencias **deliberadas y documentadas**, no descuidos — el plan de frontend está diseñado para no chocar contra ellas:

| Lo que dice la especificación | Lo que existe hoy | Cómo lo maneja este plan |
|---|---|---|
| Nivel 4 (Código) es parte de `c4Models` | Nivel 4 es una función bajo demanda, **no expuesta como comando Tauri todavía** — `generate_module_code_diagram` vive en Rust pero no tiene wrapper `#[tauri::command]` | El plan incluye como tarea previa (Fase 1) exponer `generate_module_code_diagram` como comando, antes de construir la UI de drill-down a Nivel 4 |
| Call Graph, Sequence Diagram, Dynamic Diagram, DFD (§4.4, diagramas 15-18) | ✅ **100% Implementado**: los parsers emiten `invocations` y Rust genera sus grafos suplementarios | Se implementan normalmente en la UI como vistas suplementarias interactivas en ReactFlow |
| `AnalysisRun`/`History`/versionado AMG (§3.2, §3.4) | `analyze_project` genera un AMG nuevo cada vez, sin persistir un historial navegable ni calcular `AMGDelta` | El Downbar → "Historial de Análisis" (§5.1.5) se implementa en versión reducida: lista de análisis corridos **en la sesión actual** (estado de Zustand, no persistido), sin comparación de versiones |
| `Rule`/`FitnessEvaluation`/Fitness Score (§7, Status Bar §5.1.6) | No implementado en Rust | El indicador de Fitness Score en la Status Bar se **omite** de este plan hasta que exista el motor de reglas |
| `ADR`, `Risk`, `Annotation` persistidos en `saac.annotations.json` (§5.4, §5.6) | No implementado en Rust — no hay comando para leer/escribir ese archivo | Botón "Ignorar" en Antipatrones y anotaciones en C4 quedan como **UI presente pero deshabilitada** con nota "Próximamente", en vez de fingir que persiste |
| Terminal embebida ejecutando CLI de SAAC (§5.1.5) | No existe CLI de SAAC como tal (solo los flags de testing `--scan-json` etc., que no son una CLI de usuario) | Se omite la pestaña "Terminal" del Downbar en este plan |
| Exportación PNG/SVG/Mermaid/PlantUML/Structurizr (§5.4) | No implementado en Rust | Se implementa solo exportación **JSON** del AMG/diagrama activo (dato crudo), que no requiere nada nuevo del backend; el resto de formatos queda fuera de alcance |
| `check_ai_status` contra servidor real | Solo probado en modo `Mock` (ver `test_ai_integration.py`) | La UI se construye igual (necesita mostrar el estado sea cual sea), pero se marca como pendiente de prueba manual contra Ollama real |

Todo lo NO listado en esta tabla (AMG completo, métricas por módulo/clase/función, antipatrones con `cycle_path`, C4 Niveles 1-3, Package/Inheritance/ER Diagrams, cancelación cooperativa, IA con fallback) **existe, funciona, y está cubierto por tests E2E** — se implementa en frontend tal cual está diseñado en la especificación.

---

## 1. Decisiones de Diseño

### 1.1 Stack (confirmado contra §2.2 de la especificación)

| Capa | Tecnología | Nota |
|---|---|---|
| Framework UI | React 18 + Vite 5 + TypeScript 5.x (strict) | Ya scaffoldeado por el template de Tauri |
| Estado global | Zustand | Sin slices Redux-style; un store por dominio (ver 1.3) |
| Diagramas de grafo | ReactFlow (XYFlow) | C4 (los 4 niveles), Package Diagram, Inheritance Tree, ER Diagram, grafo de dependencias general |
| Layout de grafo | `dagre` (vía `@dagrejs/dagre`) | Layout automático; ELK y Force-Directed quedan documentados como mejora futura (§5.1.2 los menciona como selector, pero solo Dagre se implementa en esta fase) |
| Tablas | TanStack Table v8 | Panel de Métricas (§5.5) |
| Estilos | TailwindCSS 3 | Utility-first, tema claro/oscuro vía CSS variables |
| Componentes accesibles | Radix UI (primitives) | Menús, diálogos, tooltips, collapsibles del layout tipo IDE |
| Comunicación con backend | `@tauri-apps/api` (`invoke`, `listen`) | IPC tipado a mano (ver 1.2) |

### 1.2 Tipos compartidos frontend↔backend

`shared/types.ts` ya existe como "espejo TypeScript del AMG" según la estructura documentada. Antes de escribir cualquier componente, se audita ese archivo contra `amg.rs` real (los tipos Rust que ya construimos: `ArchitectureModelGraph`, `Module`, `ModuleMetrics`, `Antipattern`, `C4Models`, `AiConfig`, `AiResponse`, etc.) y se corrige cualquier divergencia — serde ya serializa todo en camelCase, así que el mapeo debe ser 1:1 sin transformación adicional en el cliente.

### 1.3 Stores de Zustand (uno por dominio, no un store monolítico)

| Store | Responsabilidad |
|---|---|
| `useProjectStore` | Proyecto activo (path, nombre), estado de análisis en curso, progreso (`project://progress`), AMG actual |
| `useSelectionStore` | Elemento seleccionado en el canvas (Module/Antipattern/Dependency/C4 node) — alimenta el Rightbar (§5.1.4) |
| `useUiStore` | Estado de layout: qué paneles están abiertos/colapsados, tema claro/oscuro, tab activo del Leftbar/Downbar |
| `useDiagramStore` | Diagrama C4 actualmente renderizado, nivel de navegación (Contexto→Contenedor→Componente→Código), historial de breadcrumb |
| `useAiStore` | Historial de mensajes del chat (sesión actual, no persistido), estado de conexión (`AiStatusResult`), config activa (`AiConfig`) |
| `useAnalysisHistoryStore` | Lista de análisis corridos en la sesión (ver brecha 0.3 — reemplazo reducido de `AnalysisRun`/`History`) |

### 1.4 Capa de acceso a Tauri (`src/lib/tauri-api.ts`)

Un único módulo que envuelve **todas** las llamadas `invoke()` y `listen()`, tipadas contra los tipos de 1.2. Ningún componente llama `invoke()` directamente — todos pasan por funciones como `analyzeProject(path)`, `cancelAnalysis()`, `askAi(prompt, contextType, targetId)`, `onProjectProgress(callback)`. Esto aísla el resto del frontend de cualquier cambio futuro en la firma exacta de los comandos Rust.

---

## 2. Estructura de Carpetas Propuesta

Sigue §6.1 de la especificación, con el detalle de subcarpetas necesario para el layout tipo IDE de §5.1:

```
src/
├── main.tsx
├── App.tsx                          # Monta el AppShell
├── lib/
│   ├── tauri-api.ts                 # Única puerta de entrada a invoke()/listen()
│   └── dagre-layout.ts              # Helper de layout automático para ReactFlow
├── types/
│   └── amg.ts                       # Re-exporta/ajusta shared/types.ts si hace falta
├── stores/
│   ├── useProjectStore.ts
│   ├── useSelectionStore.ts
│   ├── useUiStore.ts
│   ├── useDiagramStore.ts
│   ├── useAiStore.ts
│   └── useAnalysisHistoryStore.ts
├── components/
│   ├── shell/                       # Layout tipo IDE (§5.1)
│   │   ├── AppShell.tsx             # Compone Topbar+Leftbar+Canvas+Rightbar+Downbar+StatusBar
│   │   ├── Topbar/
│   │   │   ├── MenuBar.tsx          # §5.1.1
│   │   │   └── Toolbar.tsx          # §5.1.2
│   │   ├── Leftbar/
│   │   │   ├── Leftbar.tsx
│   │   │   ├── ExplorerTab.tsx      # Árbol de archivos real (§5.1.3)
│   │   │   └── NavigationTab.tsx    # Árbol de secciones SAAC (§5.2)
│   │   ├── Rightbar/
│   │   │   ├── Rightbar.tsx
│   │   │   └── panels/              # Un panel por tipo de selección (§5.1.4)
│   │   │       ├── ModulePropertiesPanel.tsx
│   │   │       ├── AntipatternPropertiesPanel.tsx
│   │   │       ├── DependencyPropertiesPanel.tsx
│   │   │       └── ProjectSummaryPanel.tsx
│   │   ├── Downbar/
│   │   │   ├── Downbar.tsx
│   │   │   ├── OutputTab.tsx        # Log en tiempo real del análisis
│   │   │   ├── ProblemsTab.tsx      # Antipatrones críticos consolidados
│   │   │   └── AnalysisHistoryTab.tsx
│   │   └── StatusBar.tsx            # §5.1.6 (sin Fitness Score, ver brecha 0.3)
│   ├── dashboard/                   # §5.3
│   │   ├── DashboardView.tsx
│   │   ├── ProjectSummaryCard.tsx
│   │   ├── MetricsRadarChart.tsx
│   │   └── DependencyGraphOverview.tsx
│   ├── c4/                          # §5.4
│   │   ├── C4Viewer.tsx             # Navegación jerárquica + breadcrumb
│   │   ├── C4Canvas.tsx             # Wrapper de ReactFlow con nodos/aristas del nivel activo
│   │   ├── nodes/                   # Nodo custom de ReactFlow por elemento (Person, System, Container, Component, Class)
│   │   ├── LayoutSelector.tsx       # Solo Dagre en esta fase (ver 1.1)
│   │   └── ExportMenu.tsx           # Solo JSON en esta fase (ver brecha 0.3)
│   ├── supplementary-diagrams/      # Package/Inheritance/ER — mismo motor ReactFlow que c4/
│   │   ├── PackageDiagramView.tsx
│   │   ├── InheritanceTreeView.tsx
│   │   └── ErDiagramView.tsx
│   ├── metrics/                     # §5.5
│   │   ├── MetricsPanel.tsx
│   │   ├── ModuleMetricsTable.tsx
│   │   ├── ClassMetricsTable.tsx
│   │   └── FunctionMetricsTable.tsx
│   ├── antipatterns/                # §5.6
│   │   ├── AntipatternsPanel.tsx
│   │   ├── AntipatternCard.tsx
│   │   └── AntipatternFilters.tsx
│   ├── ai-chat/                     # §5.7
│   │   ├── AiChatPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── AiStatusIndicator.tsx
│   │   └── slash-commands.ts        # /diagram, /metrics, /explain
│   └── common/                      # Botones, badges de lenguaje/severidad, spinners, etc.
└── hooks/
    ├── useAnalysisProgress.ts       # Suscribe a project://progress
    └── useKeyboardShortcuts.ts      # Navegación Alt+letra del Menu Bar
```

---

## 3. Fases de Implementación

### Fase 0 — Fundaciones (bloqueante para todo lo demás)

1. Auditar y corregir `shared/types.ts` contra los tipos Rust reales.
2. Construir `lib/tauri-api.ts` con todas las funciones tipadas.
3. Crear los 6 stores de Zustand vacíos con su forma de estado definida.
4. Exponer `generate_module_code_diagram` como comando Tauri (`#[tauri::command] get_module_code_diagram(moduleId: string) -> C4DiagramData`) — necesario para el drill-down a Nivel 4 en Fase 3.

### Fase 1 — AppShell (layout tipo IDE vacío, sin datos)

Construir la estructura completa de §5.1 con paneles colapsables/redimensionables pero sin conectar a datos reales todavía — valida el layout y la interacción de paneles antes de rellenarlo.

1. `AppShell.tsx` con grid de 5 regiones (Topbar/Leftbar/Canvas/Rightbar/Downbar) + `StatusBar`.
2. `MenuBar` y `Toolbar` con los ítems de §5.1.1/§5.1.2 (algunos deshabilitados según brecha 0.3).
3. Leftbar con las dos pestañas (Explorer/Navigation) navegables pero con contenido placeholder.
4. Rightbar contextual reaccionando a `useSelectionStore` (vacío al inicio → `ProjectSummaryPanel` vacío).
5. Downbar con pestañas Output/Problems/AnalysisHistory (sin Terminal, ver brecha 0.3).
6. Tema claro/oscuro vía Tailwind + `useUiStore`.

### Fase 2 — Flujo de Análisis End-to-End

1. **Abrir proyecto**: diálogo nativo de selección de carpeta (`@tauri-apps/plugin-dialog`) → dispara `analyze_project`.
2. **Progreso en tiempo real**: `useAnalysisProgress` suscrito a `project://progress`, alimenta barra de progreso de la Status Bar y el log de `OutputTab`.
3. **Cancelación**: botón ⏹ en el Toolbar llama `cancel_analysis`; UI debe reflejar `cancelled: true` y outcomes parciales sin romperse (ya verificado en backend).
4. **Resultado**: al completar, `ArchitectureModelGraph` se guarda en `useProjectStore`, dispara render del Dashboard (Fase 3).
5. **Leftbar Explorer**: árbol de archivos real construido desde `amg.modules[].id`, con badge de lenguaje y color por `maintainabilityIndex`.

### Fase 3 — Dashboard y Métricas (§5.3, §5.5)

1. `ProjectSummaryCard`: nombre, tipo detectado, estilo detectado + confianza, totales (módulos, dependencias).
2. `MetricsRadarChart`: radar de métricas agregadas de `ProjectMetrics` (D3 o Recharts sobre los promedios ya calculados por el aggregator).
3. `DependencyGraphOverview`: vista general en ReactFlow de `amg.dependencies`, con clustering básico y layout Dagre.
4. `MetricsPanel` con las 3 vistas TanStack Table (Módulo/Clase/Función), ordenación, filtros por umbral, heatmap condicional, exportación CSV/JSON.

### Fase 4 — Visualizador C4 (§5.4) y Diagramas Suplementarios

1. `C4Viewer` con breadcrumb de navegación (Contexto→Contenedores→Componentes→Código) sobre `amg.c4Models`.
2. Nodos custom de ReactFlow por tipo de elemento C4 (Person, Software System, Container, Component).
3. Drill-down a Nivel 4 vía el comando expuesto en Fase 0 (`get_module_code_diagram`), al hacer doble clic en un componente.
4. `PackageDiagramView` / `InheritanceTreeView` / `ErDiagramView` / `CallGraphView` / `SequenceDiagramView` / `DynamicDiagramView` / `DfdDiagramView`: mismo motor `C4Canvas`, alimentados desde `c4Models.componentDiagrams["supplementary:*"]` que genera el backend con las invocaciones resueltas.
5. El menú de selección de diagrama (Toolbar) habilita y permite alternar entre **todos** los 12 diagramas de backend disponibles (C4 Niveles 1-3, Módulos Circulares, Paquetes, Herencia, ER, Call Graph, Sequence, Dynamic y DFD).
6. Exportación: solo JSON del diagrama activo en esta fase (ver brecha 0.3).

### Fase 5 — Antipatrones (§5.6)

1. `AntipatternsPanel` listando `amg.antipatterns` con severidad, tipo, descripción.
2. Para `circular-dependency`: mostrar `cyclePath` como ruta navegable, `suggestedBreakPoint` destacado.
3. Filtros por tipo/severidad/módulo afectado.
4. Links directos que seleccionan el módulo afectado (actualiza `useSelectionStore`, abre en el grafo).
5. Botón "Ignorar" presente pero deshabilitado con nota "Próximamente" (ver brecha 0.3 — no hay persistencia de anotaciones en Rust todavía).

### Fase 6 — Asistente IA (§5.7)

1. `AiStatusIndicator`: llama `check_ai_status` al montar y periódicamente; refleja online/offline/mock en la Status Bar y el Toolbar.
2. `AiChatPanel`: interfaz de chat con `ask_ai`, usando `AiContextType::FullAmg` por defecto.
3. Comandos especiales (`/diagram`, `/metrics`, `/explain`) parseados en `slash-commands.ts`, disparando `AiContextType::ModuleDetail`/`AntipatternDetail` según corresponda.
4. Indicador explícito de fallback: si `isMockFallback: true`, la burbuja de respuesta lo marca visualmente (ej. borde ámbar + ícono), coherente con "Modo offline visible" de §5.7.
5. Exportación del chat como Markdown (solo esto, sin persistencia entre sesiones en esta fase).

### Fase 7 — Historial de Análisis (versión reducida, ver brecha 0.3)

1. `AnalysisHistoryTab` en el Downbar: lista de análisis corridos en la sesión actual (desde `useAnalysisHistoryStore`), con timestamp y resumen (módulos, antipatrones, duración).
2. Sin comparación de versiones ni persistencia entre reinicios de la app — documentado como limitación de esta fase, no como bug.

### Fase 8 — Pulido y Accesibilidad

1. Atajos de teclado (`useKeyboardShortcuts`) para navegación Alt+letra del Menu Bar.
2. Verificación WAI-ARIA de los componentes Radix (RNF-28).
3. Estados de carga/error consistentes en todos los paneles (spinners, mensajes de error del backend mostrados sin traducir/ocultar el mensaje real de Rust).
4. Responsive básico para el colapso de Leftbar/Rightbar en pantallas pequeñas.

---

## 4. Plan de Verificación

Dado que el backend ya tiene su propia suite de tests E2E en Python (que no cubre el frontend), este plan usa un enfoque distinto para el frontend:

1. **Tests de integración manual guiados**: por cada Fase (2-7), una checklist de pasos manuales contra un proyecto de prueba real, verificando que la UI refleja exactamente lo que el backend ya probó (ej. Fase 2: cancelar un análisis a mitad de camino y confirmar que la UI muestra el resultado parcial, replicando lo que `test_analyze_project.py` ya verificó en Rust).
2. **Component tests** (Vitest + React Testing Library) para lógica no trivial: parseo de slash-commands, cálculo de breadcrumb de navegación C4, transformación de `Dependency[]` a nodos/aristas de ReactFlow.
3. Sin tests E2E automatizados de UI (Playwright/WebDriver) en el alcance de este plan — se puede añadir como fase futura si se decide invertir en ello.

---

## 5. Orden de Trabajo Recomendado

Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8.

Cada fase es funcional de forma independiente una vez completada (ej. tras la Fase 3 ya se puede analizar un proyecto y ver Dashboard+Métricas, aunque C4/Antipatrones/IA todavía no estén conectados) — permite demostrar progreso incremental sin esperar al frontend completo.