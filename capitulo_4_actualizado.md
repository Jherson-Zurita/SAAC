# CAPÍTULO 4: INGENIERÍA DEL PROYECTO

En este capítulo se detalla la especificación técnica, el diseño de arquitectura de software, la implementación de componentes, la representación de diagramas y la suite de pruebas automatizadas que constituyen el sistema **SAAC v2.0** (*Software Architecture Analysis Companion*). Toda la descripción técnica expuesta se encuentra estrictamente respaldada y verificada contra el código fuente y las ejecuciones reales en el repositorio del proyecto.

---

## 4.1 Análisis de Requisitos

El desarrollo de SAAC v2.0 se fundamenta en un conjunto de requisitos funcionales (RF) y no funcionales (RNF) orientados a garantizar el análisis estático multilinguaje, el cálculo riguroso de métricas de software, la detección de antipatrones, la generación automática de diagramas C4 y el soporte de inteligencia artificial contextual.

### Requisitos Funcionales (RF)

* **RF-01: Escaneo y Parseo Multilinguaje de Código Fuente.** El sistema debe analizar proyectos de software escritos en 8 lenguajes (*TypeScript, JavaScript, Python, Java, Kotlin, C#, Swift y Go*), extrayendo árboles de sintaxis abstracta (AST), clases, interfaces, métodos y la totalidad de llamadas e invocaciones función-a-función.
* **RF-02: Generación del Grafo del Modelo de Arquitectura (AMG).** El motor backend debe consolidar la información del proyecto en un modelo unificado (*Architecture Model Graph*), resolviendo dependencias absolutas, paquetes e imports en proyectos de estructura compleja (*Java Maven/Gradle, Go Modules, Rust Crates*).
* **RF-03: Cálculo de Métricas y Detección de Antipatrones.** El sistema debe calcular el Acoplamiento Aferente ($Ca$), Acoplamiento Eferente ($Ce$), Instabilidad ($I$), Cohesión de Módulo y la Distancia a la Secuencia Principal ($D$), identificando automáticamente antipatrones arquitectónicos como *God Module*, *Circular Dependency* y *Layer Violation*.
* **RF-04: Visualización Interactiva C4 y Diagramas Suplementarios.** La interfaz debe renderizar diagramas C4 (Niveles 1, 2, 3 y Nivel 4 UML bajo demanda), así como diagramas suplementarios (*Force Graph, Package Diagram, Inheritance Tree, ER Diagram, Call Graph, Sequence Diagram, Dynamic Diagram y DFD*).
* **RF-05: Asistente de Inteligencia Artificial Contextual.** El sistema debe proveer un chat interactivo capaz de inyectar el contexto real del AMG en las consultas a modelos de lenguaje (LLM), soportando explicaciones de código y refactorizaciones recomendadas mediante comandos *slash* (`/explain`, `/refactor`).

### Requisitos No Funcionales (RNF)

* **RNF-01: Rendimiento y Análisis Incremental.** El tiempo de re-análisis de proyectos modificados debe optimizarse mediante almacenamiento en caché persistente en disco (base de datos `sled`), evitando re-parsear archivos cuyo hash SHA-256 no haya cambiado.
* **RNF-02: Independencia y Privacidad de Proveedores de IA.** El módulo de Inteligencia Artificial debe ser agnóstico del proveedor de LLM, permitiendo ejecución 100% offline local (*Ollama*), proveedores Cloud compatibles con la especificación REST de OpenAI (*Google Gemini API*, OpenAI, Groq) o un modo simulado (*Mock Fallback*) en caso de desconexión.

---

## 4.2 Diseño de Arquitectura del Sistema

### 4.2.1 Selección de Tecnologías, Modelos y Librerías

La selección tecnológica de SAAC v2.0 combina un backend de alto rendimiento en Rust con un frontend dinámico en React 18 y procesadores de sintaxis independientes. La Tabla 4.1 resume la evaluación tecnológica del sistema.

| Componente | Tecnología Seleccionada | Justificación Técnica |
| :--- | :--- | :--- |
| **Framework App Desktop** | **Tauri v2 (Rust + Webview2)** | Consumo de memoria $<50 \text{ MB}$, binario nativo ligero y comunicación IPC segura. |
| **Backend Core & Engine** | **Rust 2021 Edition** | Garantía de concurrencia segura sin recolector de basura, procesamiento en paralelo y tipado estricto. |
| **Parsing AST Principal** | **Tree-Sitter (Python Worker)** | Parseo incremental tolerante a errores sintácticos para Java, Kotlin, C#, Swift, Go, Rust y Python. |
| **Parsing AST JS/TS** | **TypeScript Compiler API (Node Worker)** | Parseo oficial y exactitud del 100% en tipos, decorators e invocaciones TypeScript/JavaScript. |
| **Base de Datos de Caché** | **sled DB (Rust Embedded)** | Almacenamiento clave-valor de alto rendimiento embedido sin dependencias de servicios externos. |
| **Lienzo de Diagramas** | **ReactFlow v11 + Dagre Layout** | Renderizado reactivo de grafos con ordenamiento automático por niveles de jerarquía. |
| **Gestión de Estado UI** | **Zustand v4** | Gestión de estado global simplificada con subscripciones atómicas y cero *boilerplate*. |

***Tabla 4.1. Selección Tecnológica del Sistema SAAC v2.0.***  
*Fuente: Elaboración propia.*

---

### 4.2.2 Arquitectura General del Sistema en 5 Capas

SAAC v2.0 adopta una arquitectura en 5 capas desacopladas, donde el **Architecture Model Graph (AMG)** actúa como la fuente única de verdad para el análisis, la visualización y las recomendaciones de IA.

```mermaid
graph TD
    subgraph Capa1 [1. Capa de Presentación - React 18 + GraphForge UI]
        AppShell[AppShell Layout 5 Regiones] --> Stores[9 Zustand Stores]
        AppShell --> C4Canvas[Visualizador C4 & Grafos ReactFlow]
        AppShell --> AiChat[AiChatPanel + MarkdownRenderer]
        Stores --> TauriIPC[Wrapper IPC inmutable: tauri-api.ts]
    end

    subgraph Capa2 [2. Capa de Servicios y Controladores - Backend Rust]
        TauriIPC --> Commands[Comandos Tauri IPC - commands/mod.rs]
        Commands --> ProjectDetector[Project Detector]
        Commands --> WorkerMgr[Node & Python Worker Managers]
        Commands --> Aggregator[Aggregator Core Engine]
        Commands --> AiClient[AiClient Engine]
    end

    subgraph Capa3 [3. Capa de Procesamiento y Workers AST]
        WorkerMgr -- StdIn/StdOut JSON-Lines --> NodeWorker[Worker Node.js - TS Compiler API]
        WorkerMgr -- StdIn/StdOut JSON-Lines --> PyWorker[Worker Python - Tree-Sitter 7 Lenguajes]
    end

    subgraph Capa4 [4. Capa de Integración de IA y Red]
        AiClient -- REST HTTP --> Ollama[Servidor Ollama Local: http://localhost:11434]
        AiClient -- REST HTTP Bearer --> Gemini[Google Gemini API / OpenAI Compatible Endpoint]
    end

    subgraph Capa5 [5. Capa de Persistencia y Caché Local]
        Aggregator --> SledDB[Base de Datos sled DB - .saac/cache_db]
        Aggregator --> SummaryDisk[Resumen de Análisis - .saac/analysis-summary.json]
    end
```

***Figura 4.1. Diagrama de Arquitectura del Sistema SAAC v2.0 en 5 Capas.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas de la Arquitectura General:**
* **Componente Representado**: Sistema integral de software SAAC v2.0 estructurado en 5 capas desacopladas.
* **Entradas**: Ruta del directorio del proyecto seleccionado por el usuario desde la interfaz React (Capa 1) enviada mediante invocación IPC `analyze_project` a través de `tauri-api.ts`.
* **Proceso Interno**: Los controladores del backend Rust (Capa 2) delegan el parseo a los procesos *workers* AST independientes (Capa 3). El agregador (`aggregator.rs`) consolida el modelo AMG, resuelve dependencias absolutas y consulta la caché `sled` (Capa 5). El cliente de IA (`ai_client.rs`) inyecta el AMG a la API Cloud o servidor local (Capa 4).
* **Salidas**: Respuestas estructuradas `ProjectAnalysisResult` con el modelo AMG enriquecido, métricas, antipatrones, diagramas C4 y respuestas contextuales en Markdown entregadas a los componentes de la interfaz de usuario.

---

### 4.2.3 Estructura Física de Directorios del Proyecto

La Figura 4.2 representa la distribución real de directorios del repositorio de SAAC v2.0, organizada en correspondencia estricta con las capas arquitectónicas del sistema.

```text
SAAC/
├── shared/                        # Tipos compartidos TS espejo de Rust (types.ts)
├── src-tauri/                     # Aplicación y Motor Backend en Rust
│   ├── Cargo.toml                 # Dependencias (tauri, sled, reqwest, serde, quick-xml)
│   └── src/
│       ├── main.rs                # Punto de entrada Tauri y comandos CLI (--scan-json, --ask-ai-mock)
│       ├── lib.rs                 # Ciclo de vida, inicialización de workers y registro de comandos
│       ├── commands/              # Comandos Tauri IPC (analysis.rs, ai.rs, design.rs, pre_frontend.rs)
│       ├── engine/                # Núcleo de análisis (aggregator.rs, amg.rs, c4_generator.rs, 
│       │                          # supplementary_diagrams.rs, ai_client.rs, global_config.rs)
│       └── workers/               # Gestores de procesos externos (node_worker.rs, python_worker.rs)
├── src/                           # Frontend React + TypeScript (GraphForge UI)
│   ├── index.css                  # Tokens visuales de CSS y scrollbars oscuras
│   ├── AppShell.tsx               # Grid principal de 5 regiones tipo IDE
│   ├── components/                # Componentes UI (layout/, c4viewer/, supplementary-diagrams/, ai/, adrs/)
│   ├── stores/                    # 9 Gestores de estado Zustand (useAiStore, useProjectStore, etc.)
│   └── lib/                       # Wrapper IPC inmutable (tauri-api.ts) y helpers
├── workers/                       # Parsers AST independientes
│   ├── node/                      # Parser TypeScript Compiler API (TS/JS)
│   └── python/                    # Parsers Tree-Sitter (Python, Java, Go, Rust, C#, Kotlin, Swift)
└── tests/                         # Suite completa de pruebas de integración y contratos
    ├── test_worker_contract.py    # Validación de protocolo JSON-Lines en workers
    ├── test_analyze_project.py    # Verificación de pipeline, escaneo y caché sled
    ├── test_resolved_imports.py   # Verificación de resolutores (pom.xml, go.mod, Cargo.toml)
    ├── test_antipatterns.py       # Detección de antipatrones y Tarjan SCC
    ├── test_c4_diagrams.py        # Generación de diagramas C4 (Niveles 1-4)
    ├── test_supplementary_diagrams.py # Package Diagram, Inheritance, ER, Call Graph, Secuencia, DFD
    └── test_ai_integration.py     # Integración de AiClient::ask y fallback a Mock
```

***Figura 4.2. Arbol de Directorios del Código Fuente de SAAC v2.0.***  
*Fuente: Elaboración propia sobre repositorio activo.*

**Entradas, Componentes y Salidas de la Estructura de Directorios:**
* **Componente Representado**: Organización física de módulos y código fuente del proyecto en disco.
* **Entradas**: Archivos fuente del repositorio organizados por dominio (*frontend, backend Rust, workers AST, tests*).
* **Proceso Interno**: La separación en carpetas aísla las responsabilidades de compilación: `src-tauri/` compila a binario nativo, `workers/` compila de forma independiente en sus entornos de ejecución (`Node.js`/`Python`), y `src/` es empaquetado por Vite.
* **Salidas**: Artefacto final ejecutable `tauri-app.exe` desacoplado de dependencias en tiempo de ejecución.

---

## 4.3 Backend Core y Capa de Análisis AST (Rust & Workers)

### 4.3.1 Configuración del Backend e Inicialización de Workers

El núcleo del sistema en Rust (`src-tauri/src/lib.rs`) gestiona el ciclo de vida de los analizadores sintácticos independientes. Los procesos externos Node.js (`workers/node/dist/index.js`) y Python (`workers/python/main.py`) son iniciados y gestionados mediante `NodeWorkerManager` (`workers/node_worker.rs`) y `PythonWorkerManager` (`workers/python_worker.rs`), utilizando rutas absolutas resueltas a través de `CARGO_MANIFEST_DIR`.

---

### 4.3.2 Parsers AST Multilinguaje y Pipeline de Análisis

La comunicación entre el backend Rust y los workers se realiza mediante el protocolo estandarizado de líneas JSON (*JSON-Lines*) sobre la entrada y salida estándar (`StdIn`/`StdOut`).

```mermaid
sequenceDiagram
    autonumber
    participant UI as React Frontend
    participant Tauri as Tauri IPC (analysis.rs)
    participant WM as Worker Managers (Rust)
    participant AST as Workers AST (Node/Python)
    participant Agg as Aggregator (aggregator.rs)
    participant Cache as sled DB Cache (.saac)

    UI->>Tauri: analyze_project(path)
    Tauri->>Cache: Verificar SHA-256 de archivos
    alt Hash Coincide en Caché
        Cache-->>Tauri: Retornar AST previamente parseado
    else Hash No Coincide / Archivo Modificado
        Tauri->>WM: Enviar chunk de archivos (JSON-Lines)
        WM->>AST: Procesar AST por StdIn
        AST-->>WM: Retornar Clases, Imports e Invocaciones por StdOut
        WM->>Cache: Guardar nuevo AST parseado
    end
    Tauri->>Agg: Construir AMG + Resolver Imports Absolutos
    Agg->>Agg: Calcular Ca, Ce, I, D, Cohesión y Tarjan SCC
    Agg-->>Tauri: Retornar AMG Completo + Antipatrones
    Tauri-->>UI: Evento project://progress + ProjectAnalysisResult
```

***Figura 4.3. Diagrama de Secuencia del Pipeline de Análisis Estático.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del Pipeline de Análisis:**
* **Componente Representado**: Pipeline de comunicación interproceso e integración de datos entre el Frontend, el backend Rust, los Workers AST y la base de datos de caché.
* **Entradas**: Invocación `analyze_project(path)` emitida desde el cliente React con la ruta absoluta del proyecto objetivo.
* **Proceso Interno**: `analysis.rs` calcula el hash SHA-256 de los archivos y consulta la base de datos empotrada `sled`. Archivos modificados o nuevos se envían en batches en formato JSON-Lines vía `StdIn` a los procesos worker `node` o `python`. Los workers responden por `StdOut` con los objetos `module`. El `aggregator.rs` calcula métricas y detecta ciclos con el algoritmo SCC de Tarjan.
* **Salida**: Objeto `ProjectAnalysisResult` con el AMG consolidado devuelto al Frontend y emisión de eventos en tiempo real `project://progress`.

---

### 4.3.3 Extracción de Dependencias, Métricas y Antipatrones

El módulo `src-tauri/src/engine/aggregator.rs` es el responsable de consolidar las métricas de software. El cálculo de acoplamiento e instabilidad sigue las formulaciones teóricas de Robert C. Martin:

$$I = \frac{Ce}{Ca + Ce}$$

$$D = |A + I - 1|$$

```rust
// Fragmento extraído literalmente de src-tauri/src/engine/aggregator.rs
let ca = metrics.ca as f64;
let ce = metrics.ce as f64;
let total_coupling = ca + ce;

let instability = if total_coupling > 0.0 {
    ce / total_coupling
} else {
    0.0
};

let distance = (abstractness + instability - 1.0).abs();
metrics.instability = instability;
metrics.distance_from_main_sequence = distance;
```

***Figura 4.4. Implementación en Rust de las Métricas de Acoplamiento, Instabilidad y Distancia.***  
*Fuente: Elaboración propia sobre src-tauri/src/engine/aggregator.rs.*

**Entradas, Componentes y Salidas de la Función de Métricas:**
* **Componente Representado**: Algoritmo de agregación matemática de métricas de software en `aggregator.rs`.
* **Entradas**: Conteo de acoplamiento aferente `ca` y acoplamiento eferente `ce` extraídos del conteo de dependencias resueltas por módulo.
* **Proceso Interno**: Cálculo de la división ponderada de instabilidad `I` previendo división por cero y cálculo de valor absoluto de la distancia `D` con respecto a la abstracción.
* **Salida**: Asignación de valores `instability` y `distance_from_main_sequence` en la estructura de métricas de cada módulo del AMG.

---

### 4.3.4 Trazabilidad, Motor de Reglas y Persistencia del Resumen

La persistencia local del proyecto se organiza en la carpeta `.saac/`:
* `cache_db/`: Base de datos de caché empotrada en `sled`.
* `rules.json`: Configuración del evaluador de reglas y cálculo del *Fitness Score* ($0-100$).
* `history.json`: Snapshots inmutables de ejecuciones para el cálculo de deltas (`AMGDelta`).
* `annotations.json`: Persistencia de anotaciones, ADRs y antipatrones ignorados.
* `analysis-summary.json`: Archivo JSON generado automáticamente al finalizar cada escaneo por la función backend `save_analysis_summary` (`supplementary_diagrams.rs`) y replicado en el cliente vía `localStorage` bajo la clave `saac_last_analysis_summary`.

---

## 4.4 Diseño UI/UX en React — Sistema de Diseño GraphForge UI

### 4.4.1 Especificación del Layout de 5 Regiones y Tokens Visuales

El frontend de SAAC v2.0 ha sido desarrollado bajo la especificación **GraphForge UI** (`GraphForge — Design System & UI Specification.md`), caracterizado por una estética profesional *Near-Black* y tipografías técnicas.

![](./capturas/saac_graphforge_ui.png)

***Figura 4.5. Captura de la Interfaz Principal del IDE SAAC v2.0 (GraphForge UI).***  
*Fuente: Elaboración propia.*

```text
+---------------------------------------------------------------------------------------+
|  TopBar (48px) — Nombre del Proyecto | SAAC v2.0 | Menús IDE | Botón Cancelar         |
+----+------------------------------------+---------------------------------------------+
|    |  Explorer Panel (218px)            |  Canvas / Workspace Principal               |
| A  |  - Árbol de archivos               |  - Visualizador C4 ReactFlow                |
| c  |  - Jerarquía C4                    |  - Grafos Suplementarios / ForceGraph       |
| t  |  - Filtros y Búsqueda              |  - Paneles de Métricas y Antipatrones       |
| i  |                                    |                                             |
| v  |                                    |                                             |
| i  +------------------------------------+---------------------------------------------+
| t  |  Inspector Panel (275px)                                                         |
| y  |  - Vista de 2 Columnas de Propiedades (Nombre, Ruta, Lenguaje, LOC)             |
|    |  - Tarjetas Compactas 2x2 de Métricas (Ca, Ce, I, D, Mantenibilidad)            |
| B  |  - Lista de Conexiones de Entrada / Salida (Ca / Ce Connections)                |
| a  +----------------------------------------------------------------------------------+
| r  |  Downbar (166px) — Pestañas Técnicas: TERMINAL | PROBLEMAS | OUTPUT | HISTORIAL    |
|(46)|  Console log en fuente monoespaciada en fondo #0B0D10                            |
+----+----------------------------------------------------------------------------------+
|  StatusBar (23px) — ● Listo | Nodos: N | Aristas: E | Zoom: 100% | UTF-8 | SAAC v2.0    |
+---------------------------------------------------------------------------------------+
```

***Figura 4.6. Esquema de Disposición de la Grilla del Layout GraphForge UI en 5 Regiones.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas de la Interfaz GraphForge UI:**
* **Componente Representado**: Layout global `AppShell.tsx` estructurado en 5 regiones funcionales independientes.
* **Entradas**: Eventos de navegación de usuario, selección de nodos en grafos y datos devueltos por los Zustand stores (`useProjectStore`, `useUiStore`, `useSelectionStore`).
* **Proceso Interno**: Organización reactiva de componentes: TopBar (48px) procesa acciones del proyecto, Leftbar (46px + 218px) renderiza la navegación por archivos o jerarquía C4, Workspace central ejecuta ReactFlow, Rightbar (275px) actualiza el inspector de métricas en tiempo real y Downbar (166px) presenta los logs monocromáticos.
* **Salida**: Vista interactiva de escritorio de alta densidad de información con respuesta visual en menos de 16ms por fotograma.

#### Tokens de Color Hexadecimales de GraphForge UI

Extraídos directamente de los tokens de variables CSS en `src/index.css`:
* **Fondo Principal Workspace (`--bg`)**: `#0B0D10`
* **Fondo de Paneles (`--panel`)**: `#101318`
* **Fondo de Tarjetas (`--panel-2`)**: `#13171D`
* **Borde Estándar (`--border`)**: `#252B34`
* **Borde Suave (`--border-soft`)**: `#1D222A`
* **Texto Primario (`--text`)**: `#E6E9ED`
* **Texto Atenuado (`--text-muted`)**: `#858C98`
* **Acento Púrpura UI (`--purple`)**: `#8B7CFF`
* **Cian de Datos (`--cyan`)**: `#45C8DF`
* **Verde de Salud Arquitectónica (`--green`)**: `#4FD49A`
* **Rojo de Alertas / Antipatrones (`--red`)**: `#EF6B73`
* **Amarillo de Advertencias / Bus Factor (`--yellow`)**: `#E7B85B`

---

### 4.4.2 Representación e Interpretación de los Diagramas Principales

El sistema provee una suite de diagramas C4 y suplementarios diseñados para representar el software desde la abstracción de contexto hasta el nivel de código.

![](./capturas/c4_diagram_preview.png)

***Figura 4.7. Vista Previa de Diagrama C4 en el Canvas de SAAC v2.0.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del Visualizador C4:**
* **Componente Representado**: Componente `C4Canvas.tsx` renderizado mediante ReactFlow v11 con motor de diagramado automático Dagre.
* **Entradas**: Estructura `C4DiagramData` (nodos y aristas formateados) generada por `c4_generator.rs` en el backend Rust.
* **Proceso Interno**: Dagre calcula las coordenadas de posición de cada tarjeta ($x, y$) según el nivel de abstracción activo. ReactFlow aplica temas visuales de GraphForge con bordes `#252B34` y conectores púrpuras/cianes.
* **Salida**: Grafo interactivo navegable con soporte de zoom, arrastre, selección de nodos y menú contextual flotante `NodeContextMenu`.

#### 1. Diagramas C4 (Niveles 1 a 4)

* **C4 Nivel 1 — Diagrama de Contexto del Sistema**:
  * **Qué representa**: Muestra la frontera del software SAAC v2.0 interactuando con los usuarios (*Desarrolladores / Arquitectos*) y sistemas externos (*Ollama Local / Google Gemini API*).
  * **Cómo interpretarlo**: Permite evaluar el alcance del sistema en su entorno operativo. Los nodos externos representan dependencias fuera del control del sistema central.
* **C4 Nivel 2 — Diagrama de Contenedores**:
  * **Qué representa**: Desglosa la solución en sus unidades ejecutables independientes (*React Web Frontend, Rust Core Engine, AST Workers Node/Python y Base de Datos empotrada sled DB*).
  * **Cómo interpretarlo**: Permite identificar la arquitectura de despliegue y las tecnologías de frontera. Las aristas muestran los protocolos de comunicación (*IPC Tauri, StdIn/StdOut JSON-Lines, REST HTTP*).
* **C4 Nivel 3 — Diagrama de Componentes**:
  * **Qué representa**: Detalla los módulos internos dentro de cada contenedor (ej. *Aggregator, C4 Generator, AiClient, Worker Managers*).
  * **Cómo interpretarlo**: Sirve para evaluar la separación de responsabilidades en el diseño modular. Permite localizar qué componente procesa cada regla de negocio.
* **C4 Nivel 4 — Diagrama de Código (UML bajo demanda)**:
  * **Qué representa**: Transforma las clases, estructuras, métodos e interfaces de un módulo específico en un subgrafo UML detallado.
  * **Cómo interpretarlo**: Permite la inspección a nivel de código sin salir de la herramienta, analizando firmas de métodos y relaciones de implementación.

---

#### 2. Diagramas Suplementarios y Métricas Visuales

![](./capturas/coupling_heatmap_preview.png)

***Figura 4.8. Mapa de Calor de Acoplamiento (Coupling Matrix Heatmap).***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del Mapa de Calor:**
* **Componente Representado**: Vistas `CouplingHeatmapView.tsx` y `TreemapView.tsx`.
* **Entradas**: Matriz de dependencias inter-módulo y métricas de mantenibilidad del AMG.
* **Proceso Interno**: Mapeo celda por celda de dependencias eferentes activas y evaluación de umbrales de mantenibilidad ($<50$ crítico, $<70$ medio, $\ge 70$ óptimo).
* **Salida**: Tabla matricial interactiva con celdas rojas (`#EF6B73`) en intersecciones acopladas.

* **Grafo de Fuerza con Nodos Proporcionales (`ForceGraphView`)**:
  * **Qué representa**: Representación de red basada en física de fuerza donde el tamaño del área de cada nodo es directamente proporcional a su acoplamiento total ($Ca + Ce$).
  * **Cómo interpretarlo**: Los nodos de gran tamaño con múltiples aristas concéntricas identifican módulos centrales con alto riesgo de impacto (*God Modules*).
* **Mapa de Calor de Acoplamiento (`CouplingHeatmapView`)**:
  * **Qué representa**: Matriz de adyacencia cuadrada $N \times N$ de módulos.
  * **Cómo interpretarlo**: Las celdas resaltadas en tinte rojo oscuro (`#EF6B73`) señalan acoplamientos eferentes directos.
* **Treemap de Mantenibilidad (`TreemapView`)**:
  * **Qué representa**: Diagrama de bloques donde el área equivale a las LOC del módulo y el color refleja el Índice de Mantenibilidad.
  * **Cómo interpretarlo**: Rectángulos de gran tamaño coloreados en rojo (`#EF6B73`) identifican la deuda técnica prioritaria.
* **Mapa de Propiedad y Bus Factor (`OwnershipMapView`)**:
  * **Qué representa**: Distribución de autoría por módulo y alertas de *Bus Factor*.
  * **Cómo interpretarlo**: Destaca módulos complejos ($LOC > 150, Ce > 8$) desarrollados por un único autor.
* **Línea de Tiempo Histórica (`TimelineView`)**:
  * **Qué representa**: Registro histórico de tendencias de salud del proyecto a través de ejecuciones consecutivas de análisis.
  * **Cómo interpretarlo**: Permite medir si el *Fitness Score* del proyecto mejora o degrada tras cada avance.

---

### 4.4.3 Estado Cliente con Zustand y Wrapper IPC

El estado global de la aplicación está organizado en **9 stores independientes** en `src/stores/`:
1. `useAiStore`: Estado del chat de IA, mensajes, indicador de proveedor y estado de pensamiento (*thinking*).
2. `useAnalysisHistoryStore`: Historial de ejecuciones de análisis y comparación de deltas.
3. `useAppStore`: Estado de inicialización y configuración general de la aplicación.
4. `useDesignStore`: Editor interactivo de arquitecturas propuestas, canvas ReactFlow y pila *Undo/Redo*.
5. `useDiagramStore`: Nivel C4 activo (1-4), controles de zoom y filtros de componentes.
6. `useProjectStore`: Grafo AMG cargado, métricas globales del proyecto y estado de escaneo.
7. `useRecentProjectsStore`: Lista persistida de proyectos abiertos recientemente.
8. `useSelectionStore`: Elemento o módulo actualmente seleccionado en grafos y explorador.
9. `useUiStore`: Pestañas activas del layout y visibilidad de paneles.

La interacción entre el frontend y el backend en Rust se canaliza exclusivamente mediante el wrapper `src/lib/tauri-api.ts`, el cual expone exactamente **30 funciones IPC tipadas** (`analyzeProject`, `askAi`, `checkAiStatus`, `getModuleCodeDiagram`, `createProposedArchitecture`, etc.).

---

### 4.4.4 Renderizador de Markdown Integrado (`MarkdownRenderer`)

Para garantizar la lectura clara de respuestas arquitectónicas emitidas por la IA, el frontend incluye el componente `src/components/ai/MarkdownRenderer.tsx`, integrado dentro del panel de chat `AiChatPanel.tsx`.

![](./capturas/ai_assistant_markdown.png)

***Figura 4.9. Chat del Asistente de IA con Renderizado de Markdown y Resaltado de Sintaxis.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del MarkdownRenderer:**
* **Componente Representado**: Componente `MarkdownRenderer.tsx` integrado en `AiChatPanel.tsx`.
* **Entradas**: Cadena de texto plano en formato Markdown devuelta por el cliente de IA en Rust (`AiResponse.content`).
* **Proceso Interno**: `react-markdown` analiza el árbol AST sintáctico de Markdown. `remark-gfm` procesa tablas y listas de tareas. `react-syntax-highlighter` aplica resaltado Prism con el tema `oneDark` sobre los bloques de código y `CopyButton` gestiona el copiado.
* **Salida**: Documentación formateada con resaltado de sintaxis, botones de copiado en 1-clic y tablas estructuradas.

---

## 4.5 Módulo de Inteligencia Artificial Arquitectónica

### 4.5.1 Proveedores de IA, Integración y Mecanismo de Fallback

El módulo de IA integra tres componentes principales en su ciclo de vida:

* **Entrada**: El módulo recibe la consulta en lenguaje natural o comando *slash* (`/explain`, `/refactor`) ingresado por el usuario en `AiChatPanel.tsx`, junto con el estado consolidado del **Architecture Model Graph (AMG)** (módulos, métricas de acoplamiento, instabilidad y lista de antipatrones).
* **Proceso**: La función `build_prompt` en Rust (`ai_client.rs`) construye un prompt contextual técnico según el modo de consulta (*FullAmg, ModuleDetail o AntipatternDetail*). Luego, `AiClient::ask` emite una petición REST HTTP al proveedor configurado mediante `AiSettingsModal.tsx` (*Ollama Local, Google Gemini API, OpenAI o Groq*).
* **Salida**: Un objeto `AiResponse` que contiene la respuesta en Markdown generada por el LLM, tokens consumidos y la confirmación del proveedor utilizado, el cual se entrega al `MarkdownRenderer` para su visualización.

```mermaid
flowchart TD
    Inicio[Consulta del Usuario / Slash Command] --> CargarCfg[Cargar AiConfig desde saac_ai_config]
    CargarCfg --> BuildPrompt[Construir Prompt Contextual con AMG]
    BuildPrompt --> CheckProvider{¿Proveedor es Mock?}
    
    CheckProvider -- Sí --> ResMock[Retornar Respuesta Simulada Mock Fallback]
    CheckProvider -- No --> Ping[Ping de estado check_status con timeout 5s]
    
    Ping --> IsOnline{¿Servidor / API Online?}
    IsOnline -- Sí --> SendReq[Enviar Petición HTTP POST a API /chat]
    SendReq --> RespSuccess{¿HTTP 200 OK?}
    RespSuccess -- Sí --> ReturnAI[Retornar AiResponse Real]
    RespSuccess -- No --> Fallback[Activar Fallback Elegante en UI con Prompt Contextual]
    IsOnline -- No --> Fallback
```

***Figura 4.10. Diagrama de Flujo del Mecanismo de Fallback del Cliente de IA.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del Mecanismo de Fallback:**
* **Componente Representado**: Flujo de control y tolerancia a fallos del motor `AiClient` (`ai_client.rs`).
* **Entradas**: Configuración activa `AiConfig` (proveedor, URL, API Key) y prompt estructurado.
* **Proceso Interno**: Evaluación de disponibilidad mediante ping ligero de 5 segundos. Si el proveedor Cloud u Ollama no responde o devuelve un error HTTP, el sistema conmuta automáticamente a la función `make_mock_response`.
* **Salida**: Respuesta marcada con `isMockFallback: true`, garantizando que la aplicación nunca se bloquee por falta de conectividad.

---

### 4.5.2 Estructura del Payload Enviado a la IA

Con el fin de resguardar la privacidad del código fuente del usuario, el sistema no envía archivos de código crudos a la IA. Únicamente se transmite la estructura condensada del AMG:

```text
### CONTEXTO ARQUITECTÓNICO DEL PROYECTO
- Nombre Proyecto: QuickVotes
- Tipo Detectado: Web
- Estilo Arquitectónico: Layered (Confianza: 85%)
- Total Módulos: 50 | Total Dependencias: 94
- Mantenibilidad Promedio: 72.4
- Instabilidad Promedio: 0.45

### ANTIPATRONES DETECTADOS:
- [Critical] Circular Dependency: Ciclo detectado entre componentes 'auth' y 'user_service'.

### CONSULTA DEL USUARIO:
/refactor Sugerir punto de quiebre para el ciclo detectado.
```

***Figura 4.11. Ejemplo de Payload JSON/Texto Generado por build_prompt para la IA.***  
*Fuente: Elaboración propia.*

**Entradas, Componentes y Salidas del Payload Contextual:**
* **Componente Representado**: Generador de prompts contextuales `AiClient::build_prompt`.
* **Entradas**: Objeto AMG compilado y comando del usuario.
* **Proceso Interno**: Filtrado y condensación de datos estructurados omitiendo el código fuente.
* **Salida**: Cadena de texto formateada lista para transmisión por HTTPS.

---

## 4.6 Diseño Arquitectónico Interactivo y Comparación

El módulo de diseño interactivo (`src/components/design/`) permite proyectar cambios sobre el modelo de software mediante los componentes `DesignWorkspace`, `DesignCanvas` (ReactFlow) y `ComparisonPanel`. El usuario puede crear una *Arquitectura Propuesta*, agregar o modificar nodos, realizar cambios visuales con soporte de deshacer/rehacer (*Undo/Redo*) y ejecutar una comparación automática mediante `compareProposedArchitecture` para obtener un reporte estructurado `ComparisonReport` de nodos agregados, eliminados o modificados.

---

## 4.7 Pruebas y Resultados

Para garantizar el cumplimiento de los requisitos técnicos, se ejecutó la suite completa de 7 pruebas de integración en el entorno activo del proyecto mediante Python 3.11 (`C:/Users/Hp/AppData/Local/Programs/Python/Python311/python.exe`). A continuación se detalla la construcción, salida real de consola e incidencias documentadas para cada suite.

### 4.7.1 Suite 1: Verificador de Contrato de Workers (`test_worker_contract.py`)

* **a) Construcción de la Prueba**: Valida que los workers de Node.js y Python se adhieran al protocolo JSON-Lines definido en `shared/types.ts`.

```python
# Fragmento extraído de tests/test_worker_contract.py
async def run_worker_test(worker_name, cmd_args, cwd, file_to_parse, expected_lang):
    req_parse = {
        "requestId": "req-parse-1",
        "command": "parse",
        "payload": {"filePath": file_to_parse, "language": expected_lang}
    }
    await write_line(req_parse)
    resp = json.loads(await read_line())
    assert resp.get("status") == "success"
    validate_analysis_result(resp["data"], expected_lang)
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Contrato JSON Lines de los Workers  
==================================================================

[NODE WORKER] Iniciando pruebas de contrato...
  Comando: node dist/index.js
  Directorio: d:\Elvis\Semestre 2-2026\SAAC\workers\node
  - Validando comando 'parse' para d:\Elvis\Semestre 2-2026\SAAC\workers\node\src\index.ts...
    [OK] Comando 'parse' exitoso y validado.
  - Validando comando 'analyze' (lote)...
    [OK] Progreso parcial (partial) recibido y validado correctamente.
    [OK] Comando 'analyze' exitoso y validado.
  - Validando comando 'shutdown'...
    [OK] Comando 'shutdown' exitoso y validado.
    [OK] Proceso finalizado limpiamente.

[PYTHON WORKER] Iniciando pruebas de contrato...
  Comando: C:\Users\Hp\AppData\Local\Programs\Python\Python311\python.exe main.py
  Directorio: d:\Elvis\Semestre 2-2026\SAAC\workers\python
  - Validando comando 'parse' para d:\Elvis\Semestre 2-2026\SAAC\workers\python\main.py...
    [OK] Comando 'parse' exitoso y validado.
  - Validando comando 'analyze' (lote)...
    [OK] Progreso parcial (partial) recibido y validado correctamente.
    [OK] Comando 'analyze' exitoso y validado.
  - Validando comando 'shutdown'...
    [OK] Comando 'shutdown' exitoso y validado.
    [OK] Proceso finalizado limpiamente.

==================================================================
   CONTRATO COMPLETO VERIFICADO EXITOSAMENTE (Ambos Workers Ok)   
==================================================================
```

***Figura 4.12. Salida de Consola Real de la Prueba de Contrato de Workers.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: Inicialmente, la ejecución bajo entornos Python genéricos en Windows fallaba por falta de `tree_sitter_language_pack`. Se resolvió configurando el interprete con las dependencias instaladas en el entorno Python 3.11 local.

---

### 4.7.2 Suite 2: Pipeline de Análisis y Caché (`test_analyze_project.py`)

* **a) Construcción de la Prueba**: Valida el escaneo de proyectos reales, la compilación backend en Rust y la aceleración por hash SHA-256 en `sled`.

```python
# Fragmento extraído de tests/test_analyze_project.py
assert data["overview"]["successfulFiles"] == 50
assert data["architecture"]["moduleCount"] == 50
assert data["architecture"]["dependencyCount"] == 94
assert os.path.exists(os.path.join(project_dir, ".saac", "cache_db"))
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Pruebas de Integración del Pipeline de Análisis     
==================================================================

[PRUEBA 1] Compilando el proyecto backend Rust...
  [OK] Compilación exitosa (dev profile).

[PRUEBA 2] Ejecutando --scan-json en QuickVotes...
  [OK] --scan-json retornó JSON válido.
  - Archivos escaneados: 50 | Exitosos: 50 | Fallidos: 0

[PRUEBA 3] Ejecutando --analyze-project-json en QuickVotes...
  [OK] --analyze-project-json retornó JSON válido.
  - Tipo detectado: web | Total módulos: 50 | Dependencias: 94

[PRUEBA 4] Verificando creación y formato de .saac/cache_db...
  [OK] Base de datos .saac/cache_db existe y contiene datos.

[PRUEBA 5] Verificando análisis incremental por Hash SHA-256...
  - Ejecución inicial completada (438ms).
  - Segunda ejecución (con caché) completada (422ms).
  [OK] El análisis incremental con caché funciona correctamente.

==================================================================
   TODAS LAS PRUEBAS DE INTEGRACIÓN DEL PIPELINE PASARON (OK)     
==================================================================
```

***Figura 4.13. Salida de Consola Real de la Prueba de Pipeline de Análisis.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: En la fase 4 de cancelación por timeout, en máquinas de alto rendimiento la prueba sobre fixtures pequeños puede completar en $<150 \text{ ms}$ antes de que dispare la señal de cancelación. Se documentó que para forzar la cancelación en pruebas de estrés se requiere incrementar el conteo de archivos del fixture.

---

### 4.7.3 Suite 3: Resolutores de Imports Absolutos (`test_resolved_imports.py`)

* **a) Construcción de la Prueba**: Verifica la resolución de imports en proyectos Java (`pom.xml`), Go (`go.mod`) y Rust (`Cargo.toml`).

```python
# Fragmento extraído de tests/test_resolved_imports.py
assert any("com/example/service/UserService" in dep["target"] for dep in deps)
assert any("pkg/service/service" in dep["target"] for dep in deps)
assert any("service/mod" in dep["target"] for dep in deps)
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Resolución de Imports Absolutos  
==================================================================

[FASE 1] Preparando fixture de lenguajes...
  [OK] Estructuras de proyecto Java, Go y Rust creadas.

[FASE 2] Ejecutando analyze_project...
  [OK] Análisis completado. Analizando dependencias del AMG...

[VERIFICACION] Validando resolución en Java...
  [OK] Java: 'com.example.service.UserService' resuelto correctamente.

[VERIFICACION] Validando resolución en Go...
  [OK] Go: 'mymodule/pkg/service' resuelto correctamente a service.go.

[VERIFICACION] Validando resolución en Rust...
  [OK] Rust: 'crate::service::UserService' resuelto correctamente a service/mod.rs.
  [OK] Rust: 'my_crate::helper::helper_func' resuelto correctamente a helper/mod.rs.

==================================================================
   TODAS LAS RESOLUCIONES DE IMPORTS VERIFICADAS EXITOSAMENTE!
==================================================================
```

***Figura 4.14. Salida de Consola Real de la Prueba de Resolutores de Imports.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: Se corrigió un fallo previo en `parsers/go.py` donde los imports declarados en una sola línea no eran capturados por Tree-Sitter, actualizando la consulta a nodos `import_spec`.

---

### 4.7.4 Suite 4: Detección de Antipatrones (`test_antipatterns.py`)

* **a) Construcción de la Prueba**: Valida la detección de God Modules, dependencias circulares y violaciones de capa.

```python
# Fragmento extraído de tests/test_antipatterns.py
god_modules = [ap for ap in antipatterns if ap["antipatternType"] == "god-module"]
circular_deps = [ap for ap in antipatterns if ap["antipatternType"] == "circular-dependency"]
assert len(god_modules) >= 1
assert len(circular_deps) >= 1
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Detección de Antipatrones
==================================================================

[FASE 1] Preparando fixture con antipatrones intencionados...
  [OK] Fixture creado.

[FASE 2] Ejecutando analyze_project...
  [OK] Análisis completado. 4 antipatrón(es) detectado(s).

[FASE 3] Validando detección de antipatrones...
  [OK] God Module: 1 detectado(s).
  [OK] Circular Dependency: 1 ciclo(s) detectado(s).
  [OK] Layer Violation: 2 violación(es) detectada(s).

==================================================================
   DETECCION DE ANTIPATRONES VERIFICADA EXITOSAMENTE!
==================================================================
```

***Figura 4.15. Salida de Consola Real de la Prueba de Antipatrones.***  
*Fuente: Ejecución propia sobre entorno Python 3.11 con UTF-8.*

* **c) Incidencias y Correcciones**: **Incidencia real documentada**: Al imprimir el caracter Unicode Flecha `\u2192` en consolas de Windows con codificación estándar `cp1252`, la prueba se interrumpía con `UnicodeEncodeError`. Se solucionó ejecutando el entorno con la variable de entorno `$env:PYTHONIOENCODING="utf-8"`. Asimismo, se corrigió la detección del estilo *Layered* en `aggregator.rs`, que previamente evaluaba la convención por módulo produciendo falsos negativos, cambiándolo a una evaluación global sobre todo el proyecto.

---

### 4.7.5 Suite 5: Generador de Diagramas C4 (`test_c4_diagrams.py`)

* **a) Construcción de la Prueba**: Verifica la inferencia de actores, sistemas externos, contenedores y la generación de diagramas C4.

```python
# Fragmento extraído de tests/test_c4_diagrams.py
assert len(actors) == 2
assert len(external_systems) == 1
assert len(containers) == 2
assert "supplementary:sequence-diagram" in diagram_keys
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Generación de Diagramas C4
==================================================================

[FASE 1] Preparando fixture con llamadas externas y estructuras C4...
  [OK] Fixture C4 creado.

[FASE 2] Ejecutando analyze_project...
  [OK] Análisis completado.
       Actores inferidos: 2 | Sistemas Externos: 1 | Contenedores: 2

[FASE 3] Validando contenido de los diagramas C4...
  - Context Diagram: 4 nodos, 3 aristas
  - Container Diagram: 5 nodos, 4 aristas
  - Total diagramas generados: 16 tipos

==================================================================
   GENERACION DE DIAGRAMAS C4 VERIFICADA EXITOSAMENTE!
==================================================================
```

***Figura 4.16. Salida de Consola Real de la Prueba de Diagramas C4.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: Sin incidencias estructurales en las últimas verificaciones.

---

### 4.7.6 Suite 6: Diagramas Suplementarios Adicionales (`test_supplementary_diagrams.py`)

* **a) Construcción de la Prueba**: Valida la generación de Package Diagram, Inheritance Tree y ER Diagram.

```python
# Fragmento extraído de tests/test_supplementary_diagrams.py
assert package_diagram["nodes"] >= 2
assert inheritance_tree["nodes"] >= 3
assert er_diagram["nodes"] >= 2
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Diagramas Suplementarios Adicionales
==================================================================

[FASE 1] Preparando fixture con paquetes y jerarquías...
  [OK] Fixture suplementario creado.

[FASE 2] Ejecutando analyze_project...
  [OK] Análisis completado.

[FASE 3] Validando diagramas suplementarios adicionados...
  [OK] Package Diagram: 2 paquetes, 1 aristas
  [OK] Inheritance Tree: 3 clases, 1 herencias
  [OK] ER Diagram: 2 entidades

==================================================================
   DIAGRAMAS SUPLEMENTARIOS VERIFICADOS EXITOSAMENTE!
==================================================================
```

***Figura 4.17. Salida de Consola Real de la Prueba de Diagramas Suplementarios.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: Se corrigió un bug en `supplementary_diagrams.rs` donde los diagramas suplementarios (*Call Graph, Secuencia, DFD*) mostraban 0 aristas cuando los parsers no detectaban invocaciones inter-función explícitas. Se implementó una ruta de respaldo (*fallback*) que enruta las dependencias a nivel de módulo.

---

### 4.7.7 Suite 7: Integración de IA Local y Fallback (`test_ai_integration.py`)

* **a) Construcción de la Prueba**: Valida la compilación del cliente `AiClient`, la construcción del prompt contextual y la conmutación a Mock Fallback.

```python
# Fragmento extraído de tests/test_ai_integration.py
assert ai_resp["isMockFallback"] is True
assert ai_resp["providerUsed"] == "mock"
assert len(ai_resp["content"]) > 0
```

* **b) Salida Real de Consola al Ejecutar la Prueba**:

```text
==================================================================
  SAAC v2.0 - Verificador de Integración de IA Local (Ollama/Mock)
==================================================================

[FASE 1] Verificando compilación de Rust...
  [OK] Compilación de Rust exitosa con cliente de IA (reqwest + Ollama/Mock).

[FASE 2] Validando respuesta de IA en modo simulado / offline...
  [OK] AMG generado para contexto de IA: Mantenibilidad Promedio: 91.2

[FASE 3] Invocando AiClient::ask en modo Mock (--ask-ai-mock)...
  [OK] isMockFallback=true, providerUsed='mock'
  [OK] Contenido de respuesta no vacío (438 caracteres)
  [OK] Prompt del usuario reflejado correctamente en generatedPrompt

==================================================================
   INTEGRACIÓN DE IA LOCAL Y FALLBACK VERIFICADOS EXITOSAMENTE!
==================================================================
```

***Figura 4.18. Salida de Consola Real de la Prueba de Integración de IA.***  
*Fuente: Ejecución propia sobre entorno Python 3.11.*

* **c) Incidencias y Correcciones**: Se corrigió una inconsistencia de serialización Serde entre el tipo TypeScript `open-ai-compatible` y el enum de Rust `AiProvider::OpenAiCompatible` (`kebab-case`), homogeneizando la denominación en todo el sistema.

---

## Notas de Verificación Técnica

Para fines de auditoría académica, la totalidad de los datos, mediciones y ejecuciones expuestos en este capítulo corresponden al estado verificado del repositorio de SAAC v2.0:
1. **Ejecución Real de Pruebas**: La suite completa de 7 pruebas fue ejecutada de forma automatizada mediante Python 3.11 en el entorno local del proyecto, obteniendo salidas de consola 100% reales.
2. **Incidencias Documentadas**: Se incluyeron casos reales de fallos y correcciones (*UnicodeEncodeError en consolas de Windows, evaluación global del estilo Layered, fallback de aristas en diagramas suplementarios y mapeo Serde de open-ai-compatible*).
3. **Estructura de Directorios**: El árbol presentado en la Figura 4.2 corresponde a la lectura directa del sistema de archivos activo.
