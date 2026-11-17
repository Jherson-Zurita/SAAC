# SAAC v2.0 — Módulo de Diseño Arquitectónico Interactivo

### Especificación Técnica — Cobertura del Objetivo Específico #4

> **Objetivo Específico #4 (Perfil de Grado):** *"Construir un módulo interactivo de diseño, basado en edición visual de diagramas tipo canvas, con componentes arrastrables, que utilice los grafos de dependencias y patrones arquitectónicos detectados en el análisis para permitir modificar o planificar nuevas arquitecturas de software de manera visual."*

Este documento especifica el módulo que cierra la brecha entre el perfil de grado y el estado actual de implementación de SAAC (que hoy cubre análisis y visualización, pero no edición/diseño). Sigue las mismas convenciones que `SAAC_v2_0_Especificacion_Tecnica.md`: modelo de dominio primero, estructura de datos después, luego IPC, frontend y plan de implementación.

---

## 1. Decisiones de Alcance

Con base en la conversación de definición de alcance, este módulo cubre:

| Decisión | Resolución |
|---|---|
| **Alcance funcional** | Edición del AMG existente **+** creación de nodos/componentes nuevos que no existen en el código (diseño desde cero / arquitectura propuesta). |
| **Base técnica del canvas** | Se reutiliza **ReactFlow** (ya integrado para C4 vía `C4Canvas`), extendido con un **modo edición**. No se introduce una librería de canvas nueva. |
| **Persistencia** | Nueva entidad `ProposedArchitecture`, persistida en `.saac/proposed_architectures/<id>.json`, **separada del AMG real**. No contamina el grafo derivado del análisis estático. Versionado con el mismo patrón de snapshots que `HistoryManager`. |

Esto significa que el AMG real (`AnalysisRun` → `AMG`) **sigue siendo inmutable**, como ya está formalizado en la sección 3.4 de la especificación técnica principal ("el AMG nunca se edita in-place"). Una `ProposedArchitecture` es una entidad de dominio distinta que *parte* de un AMG (o de cero) pero vive en su propio espacio de nombres.

---

## 2. Modelo de Dominio

Extensión del modelo de dominio general (sección 3.2 de la spec técnica):

```
Project (1)
 │
 ├── AnalysisRun (0..N) ──▶ AMG (real, inmutable, existente)
 │
 └── ProposedArchitecture (0..N)          ← NUEVO
       ├── basedOnAnalysisRunId (0..1)     — referencia opcional al AMG de partida; null = "desde cero"
       ├── ProposedNode (0..N)             — nodo real importado (congelado) o nodo nuevo (propuesto)
       ├── ProposedEdge (0..N)             — arista real importada o nueva
       ├── DesignSnapshot (0..N)           — historial de versiones del diseño (undo/redo persistente)
       └── ComparisonReport (0..1)         — diff contra el AMG real, calculado bajo demanda
```

**Reglas de dominio:**

- Una `ProposedArchitecture` puede nacer de dos formas: **(a) derivada** — se inicializa copiando un subconjunto o la totalidad de nodos/aristas de un `AMG` existente como punto de partida editable; **(b) desde cero** — canvas vacío, `basedOnAnalysisRunId = null`.
- Un `ProposedNode` lleva un flag `origin: "imported" | "proposed"`. Los nodos `imported` retienen el `id` estable del AMG original (para poder recalcular el diff); los `proposed` reciben un nuevo id generado localmente (`prop_<uuid>`).
- Editar un nodo `imported` (renombrarlo, moverlo, cambiar sus propiedades) **no modifica el AMG real** — genera una copia local con el mismo `id` base más un flag `modified: true`, de forma que el `ComparisonReport` pueda distinguir "nodo sin cambios", "nodo modificado" y "nodo nuevo".
- Un `Project` puede tener múltiples `ProposedArchitecture` en paralelo (ej. "Propuesta: migrar a microservicios", "Propuesta: separar módulo de pagos").

---

## 3. Estructura de Datos (Rust)

### 3.1 `engine/design/mod.rs` — Modelos del Diseño Propuesto

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposedArchitecture {
    pub id: String,                          // "design_<uuid>"
    pub project_id: String,
    pub name: String,                        // nombre dado por el usuario, ej. "Migración a microservicios"
    pub description: Option<String>,
    pub based_on_analysis_run_id: Option<String>,
    pub created_at: String,                  // ISO 8601
    pub updated_at: String,
    pub nodes: Vec<ProposedNode>,
    pub edges: Vec<ProposedEdge>,
    pub canvas_layout: CanvasLayout,          // posiciones x/y persistidas (ReactFlow)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposedNode {
    pub id: String,
    pub origin: NodeOrigin,                  // Imported | Proposed
    pub original_node_id: Option<String>,    // id en el AMG real, si origin = Imported
    pub node_type: String,                   // reutiliza los tipos de 3.3.1: Module, Container, ExternalSystem, Actor
    pub label: String,
    pub modified: bool,                      // true si difiere del nodo original importado
    pub properties: serde_json::Value,       // libre, específico del tipo (ej. lenguaje sugerido, responsabilidad)
    pub position: NodePosition,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum NodeOrigin {
    Imported,
    Proposed,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposedEdge {
    pub id: String,
    pub origin: NodeOrigin,
    pub original_edge_id: Option<String>,
    pub source: String,                      // ProposedNode.id
    pub target: String,
    pub edge_type: String,                   // Dependency, Containment, ExternalCall (3.3.2)
    pub label: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NodePosition { pub x: f64, pub y: f64 }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CanvasLayout {
    pub viewport: NodePosition,
    pub zoom: f64,
}
```

### 3.2 `engine/design/comparison.rs` — Diff contra el AMG real

Reutiliza el mismo mecanismo que `AMGDelta` (sección 3.4.1), pero comparando `ProposedArchitecture` contra un `AMG`:

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ComparisonReport {
    pub proposed_architecture_id: String,
    pub compared_against_run_id: String,
    pub nodes_added: Vec<String>,       // ids con origin = Proposed
    pub nodes_removed: Vec<String>,     // ids presentes en AMG real, ausentes en el diseño
    pub nodes_modified: Vec<NodeDiff>,  // ids con modified = true, con detalle de qué cambió
    pub edges_added: Vec<String>,
    pub edges_removed: Vec<String>,
    pub structural_summary: String,     // texto generado (regla simple, no IA) ej. "3 módulos nuevos, 1 eliminado, acoplamiento estimado +12%"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NodeDiff {
    pub node_id: String,
    pub field: String,       // "label" | "type" | "properties.x"
    pub before: String,
    pub after: String,
}
```

> `structural_summary` puede opcionalmente enriquecerse enviando el `ComparisonReport` al `AiClient` ya existente (`ai_client.rs`) bajo un nuevo modo de prompt `DesignComparison`, reutilizando `build_prompt` — no requiere lógica de IA nueva, solo un nuevo `PromptMode`.

### 3.3 Persistencia

Sigue el patrón ya usado por `HistoryManager` (`history.rs`) y `AnnotationsManager` (`annotations.rs`), sin usar `sled` (estas entidades son pocas y editadas directamente por el usuario, no derivadas de un pipeline de análisis masivo — igual que `annotations.json` y `rules.json`):

```
.saac/
└── proposed_architectures/
    ├── index.json                    # lista de {id, name, updatedAt} para listado rápido en UI
    ├── design_<uuid>.json            # ProposedArchitecture completo
    └── design_<uuid>_snapshots/      # historial de versiones (undo/redo persistente entre sesiones)
        ├── snapshot_0001.json
        └── snapshot_0002.json
```

`DesignSnapshot` reutiliza la misma lógica de snapshotting simple que `history.rs` (guardar estado completo, no diffs, dado que el volumen de datos de un diseño propuesto es órdenes de magnitud menor que un AMG completo).

---

## 4. Comandos Tauri (IPC)

Nuevos comandos expuestos en `commands/design.rs`, siguiendo la convención de `commands/pre_frontend.rs` y `commands/ai.rs`:

| Comando | Firma | Descripción |
|---|---|---|
| `create_proposed_architecture` | `(project_path, name, based_on_run_id: Option<String>) -> ProposedArchitecture` | Crea diseño nuevo; si `based_on_run_id` está presente, clona nodos/aristas del AMG indicado con `origin: Imported`. |
| `list_proposed_architectures` | `(project_path) -> Vec<ProposedArchitectureSummary>` | Lee `index.json`. |
| `get_proposed_architecture` | `(project_path, design_id) -> ProposedArchitecture` | Carga diseño completo. |
| `update_proposed_architecture` | `(project_path, design_id, ProposedArchitecture) -> ()` | Guarda cambios (debounced desde el frontend, no por cada drag). |
| `add_proposed_node` | `(project_path, design_id, node_type, label, position) -> ProposedNode` | Crea nodo `Proposed` vacío para que el usuario lo configure. |
| `delete_proposed_architecture` | `(project_path, design_id) -> ()` | Elimina diseño y sus snapshots. |
| `compare_proposed_architecture` | `(project_path, design_id, against_run_id) -> ComparisonReport` | Ejecuta el diff de la sección 3.2. |
| `export_proposed_architecture` | `(project_path, design_id, format: ExportFormat) -> String` | `format`: `StructurizrDsl \| PlantUml \| Mermaid` — reutiliza los serializadores ya mencionados en la Capa 4 de la spec técnica ("Exportación: generación de Structurizr DSL, PlantUML, Mermaid"), aplicados sobre `ProposedArchitecture` en vez de sobre el AMG. |

---

## 5. Frontend (React + TypeScript + ReactFlow)

### 5.1 Ubicación en la navegación

Se agrega como nueva sección en el árbol de navegación del Leftbar (sección 5.1.3 / 5.2 de la spec técnica), al mismo nivel que "Dashboard", "Visualizador C4" y "Antipatrones":

```
📁 Navegación SAAC
 ├── 📊 Dashboard
 ├── 🏛️ Visualizador C4
 ├── 📈 Métricas Detalladas
 ├── ⚠️ Antipatrones
 ├── 🎨 Diseño Arquitectónico   ← NUEVO
 │    ├── + Nuevo diseño (desde cero)
 │    ├── + Nuevo diseño (desde AMG actual)
 │    └── [lista de ProposedArchitecture existentes]
 └── 🤖 Asistente IA
```

### 5.2 Componente principal — `DesignCanvas.tsx`

Extiende el patrón ya usado por `C4Canvas` (ReactFlow + Dagre para autolayout inicial), agregando:

- **Modo edición activo por defecto** (a diferencia de `C4Canvas`, que es de solo lectura): `nodesDraggable`, `nodesConnectable`, `elementsSelectable` en `true`.
- **Paleta de componentes arrastrables** (panel lateral, reutilizando el patrón visual del Rightbar/Properties Window de 5.1.4): tarjetas para cada `node_type` (`Module`, `Container`, `ExternalSystem`, `Actor`) que el usuario arrastra al canvas para instanciar un `ProposedNode` con `origin: Proposed`.
- **Distinción visual** entre nodos `imported` (borde sólido, color heredado del tipo real) y nodos `proposed` (borde punteado, color distintivo) y nodos `modified` (badge de "editado").
- **Conexión de aristas**: arrastrar desde el handle de un nodo a otro crea un `ProposedEdge`; un modal contextual permite fijar `edge_type` y `label`.
- **Toolbar de diseño**: deshacer/rehacer (usa `DesignSnapshot`), guardar, comparar contra AMG, exportar.
- **Panel de comparación** (`ComparisonPanel.tsx`): muestra el `ComparisonReport` en formato de lista categorizada (añadidos/eliminados/modificados) más el `structural_summary`.

### 5.3 Store (Zustand)

Nuevo store `useDesignStore.ts`, siguiendo el patrón de los 6 stores ya existentes (Fase 0 de `project_status.md`):

```typescript
interface DesignState {
  currentDesign: ProposedArchitecture | null;
  designs: ProposedArchitectureSummary[];
  history: ProposedArchitecture[];       // pila local para undo/redo, sincronizada con snapshots
  historyIndex: number;
  isDirty: boolean;                      // controla el guardado debounced
  comparisonReport: ComparisonReport | null;

  loadDesigns: (projectPath: string) => Promise<void>;
  createDesign: (name: string, basedOnRunId?: string) => Promise<void>;
  addNode: (type: NodeType, position: NodePosition) => void;
  addEdge: (source: string, target: string, type: EdgeType) => void;
  updateNode: (nodeId: string, changes: Partial<ProposedNode>) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;              // debounced, llama a update_proposed_architecture
  compare: (againstRunId: string) => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<string>;
}
```

---

## 6. Plan de Implementación (Kanban)

Coherente con la metodología ya definida en el perfil (sección 2.9), se propone dividir el trabajo en tarjetas acotadas:

| # | Tarjeta | Capa | Criterio de aceptación |
|---|---|---|---|
| 1 | Modelos `ProposedArchitecture`/`ProposedNode`/`ProposedEdge` en Rust + serde | Backend | Compila, serializa/deserializa a JSON correctamente en tests unitarios |
| 2 | Persistencia en `.saac/proposed_architectures/` (crear, leer, listar, borrar) | Backend | Tests de round-trip: crear → guardar → recargar → mismos datos |
| 3 | Comando `create_proposed_architecture` con clonado desde AMG existente | Backend | Al crear "desde AMG actual", los nodos importados retienen su `id` original |
| 4 | Comandos CRUD completos + registro en `commands/mod.rs` | Backend | Los 7 comandos de la sección 4 responden vía CLI de test (`--*-json`, mismo patrón que `analysis.rs`) |
| 5 | `ComparisonReport` (diff estructural) | Backend | Test con un AMG fijo + un diseño con nodos añadidos/eliminados/modificados produce el diff esperado |
| 6 | Exportación a Structurizr DSL / PlantUML / Mermaid | Backend | Output válido verificable con un parser/linter de cada formato |
| 7 | `DesignCanvas.tsx` en modo edición sobre ReactFlow existente | Frontend | Se pueden arrastrar, mover y conectar nodos en el canvas |
| 8 | Paleta de componentes arrastrables + creación de `ProposedNode` | Frontend | Arrastrar una tarjeta de la paleta al canvas crea un nodo `proposed` |
| 9 | `useDesignStore` + guardado debounced + undo/redo | Frontend | Ctrl+Z/Ctrl+Y funcionan sobre cambios locales antes de guardar |
| 10 | `ComparisonPanel.tsx` + integración de exportación en la UI | Frontend | El usuario ve el diff y puede descargar el archivo exportado |
| 11 | (Opcional) `PromptMode::DesignComparison` en `ai_client.rs` para resumen narrativo del diff | Backend + IA | El chat de IA puede explicar en lenguaje natural el impacto del diseño propuesto |

Las tarjetas 1–6 son extensiones naturales del backend ya maduro (reutilizan `serde`, el patrón de comandos, y los serializadores de exportación ya previstos en la Capa 4). Las tarjetas 7–10 son el trabajo nuevo real, apoyado en que `ReactFlow` y `Dagre` ya están integrados y probados en `C4Canvas`.

---

## 7. Impacto en el Perfil de Grado

Este módulo, una vez implementado, cubre íntegramente el Objetivo Específico #4 tal como está redactado en el perfil:

- ✅ "basado en edición visual de diagramas tipo canvas" → `DesignCanvas.tsx` sobre ReactFlow.
- ✅ "con componentes arrastrables" → paleta de nodos arrastrables (5.2).
- ✅ "que utilice los grafos de dependencias y patrones arquitectónicos detectados en el análisis" → creación "desde AMG actual" con clonado de nodos reales.
- ✅ "para permitir modificar... arquitecturas de software" → edición de nodos `imported`.
- ✅ "...o planificar nuevas arquitecturas de software de manera visual" → nodos `proposed`, diseño desde cero.

No requiere cambios en el objetivo general ni en los objetivos específicos 1–3, que ya están cubiertos por la implementación actual.
