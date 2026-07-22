# SAAC v2.0 — Estado y Estructura del Proyecto

Este documento registra el progreso actual del desarrollo de SAAC v2.0 (Software Architecture Analysis Companion), detallando la estructura de directorios, los módulos implementados y el estado funcional de cada componente de la aplicación.

---

## 🗺️ Mapa de Arquitectura de SAAC v2.0

```mermaid
graph TD
    subgraph Frontend [Capa de Presentación (React + TS + Vite)]
        UI[Componentes UI / Vistas] --> Stores[Estado / Zustand]
        Stores --> TauriIPC[Tauri IPC / Commands]
    end

    subgraph Backend [Motor Backend Core (Rust + Tauri)]
        TauriIPC --> Commands[Comandos Tauri]
        Commands --> Detector[Project Detector]
        Commands --> Cache[Cache Manager - sled]
        Commands --> Aggregator[Aggregator]
        Aggregator --> AMG[Architecture Model Graph - Models]
        Aggregator --> Antipatterns[Detector de Antipatrones]
        Aggregator --> C4Gen[C4 Generator]
        C4Gen --> SuppDiag[Supplementary Diagrams]
        Commands --> AiClient[AI Client - Ollama/OpenAI/Mock]

        subgraph Resolutores [Resolución de Imports Absolutos]
            Aggregator --> JavaRes[Java Source Roots Resolver]
            Aggregator --> GoRes[Go Module Roots Resolver]
            Aggregator --> RustRes[Rust Crate Roots Resolver]
        end
    end

    subgraph Workers [Capa de Análisis AST (Workers)]
        Commands --> NodeWorkerMgr[Node Worker Manager]
        Commands --> PyWorkerMgr[Python Worker Manager]

        NodeWorkerMgr -- StdIn/StdOut JSON-Lines --> NodeProcess[Worker Node: TS/JS Parser]
        PyWorkerMgr -- StdIn/StdOut JSON-Lines --> PyProcess[Worker Python: Java, Go, Rust, Python, C#, Kotlin, Swift]
    end

    AiClient -- HTTP REST --> LLMServer[Servidor LLM Local: Ollama / LM Studio / vLLM]

    Cache -- Persistencia Sled DB --> CacheDisk[HDD: .saac/cache_db]
```

---

## 📂 Estructura del Proyecto y Archivos

A continuación se detalla el árbol de directorios con el propósito de los archivos clave creados o modificados hasta la fecha:

```text
SAAC/
├── .saac/                         # Base de datos local por proyecto (creada en análisis)
│   └── cache_db/                  # Base de datos persistente de caché (sled)
├── shared/                        # Tipos de datos compartidos entre frontend y workers
│   └── types.ts                   # Espejo TypeScript del Architecture Model Graph (AMG)
├── src-tauri/                     # Backend escrito en Rust (Aplicación Tauri)
│   ├── Cargo.toml                 # Dependencias (tauri, sled, sha2, chrono, quick-xml, reqwest, etc.)
│   └── src/
│       ├── main.rs                # Punto de entrada + soporte de CLI para test (--scan-json,
│       │                          # --analyze-project-json, --ask-ai-mock)
│       ├── lib.rs                 # Inicialización de workers, registro de comandos y ciclo de vida
│       ├── ollama/
│       │   └── mod.rs             # Placeholder de cliente HTTP Ollama (struct base, sin lógica aún)
│       ├── commands/               # Comandos Tauri expuestos al frontend
│       │   ├── mod.rs             # Declaración y exportación de comandos
│       │   ├── analysis.rs        # Orquestación de escaneo, workers, caché, agregador y cancelación
│       │   ├── project.rs         # Placeholders para manejo e inicialización de proyectos
│       │   └── ai.rs              # Comandos Tauri IPC reales: check_ai_status, ask_ai
│       ├── engine/                # Núcleo y motor de análisis arquitectónico
│       │   ├── mod.rs             # Declaración de submódulos del motor
│       │   ├── amg.rs             # Modelos de datos del Grafo del Modelo de Arquitectura (AMG) en Rust
│       │   ├── aggregator.rs      # Resolución de imports, cálculo de acoplamiento (Ca/Ce/I/D/Cohesión), ciclos (Tarjan) y antipatrones
│       │   ├── project_detector.rs    # Inferencia de tipo de proyecto (Desktop, Mobile, etc.) y lenguajes dominantes
│       │   ├── cache.rs               # Sistema de almacenamiento incremental y lectura en base de datos sled
│       │   ├── java_source_roots.rs   # Extractor de raíces fuente Java mediante pom.xml y build.gradle
│       │   ├── go_module_roots.rs     # Extractor de paths lógicos de módulos Go mediante go.mod
│       │   ├── rust_crate_roots.rs    # Extractor de estructura de crates Rust mediante Cargo.toml
│       │   ├── c4_generator.rs        # Generador de Diagramas C4 (Niveles 1-4) + subgrafo de módulos circulares
│       │   ├── supplementary_diagrams.rs # Package Diagram, Inheritance Tree y ER Diagram
│       │   └── ai_client.rs           # Cliente IA: AiConfig, AiClient (check_status, ask, build_prompt), fallback Mock
│       └── workers/               # Manejadores de los procesos analizadores externos (AST)
│           ├── mod.rs             # Declaración de manejadores de workers
│           ├── types.rs           # Definición de estructuras del protocolo de comunicación interproceso
│           ├── node_worker.rs     # Control de ejecución y mensajería del subproceso Node.js
│           └── python_worker.rs   # Control de ejecución y mensajería del subproceso Python
├── workers/                       # Código ejecutable de los analizadores sintácticos AST independientes
│   ├── node/                      # Analizador sintáctico para TypeScript/JavaScript (Capa 4)
│   │   ├── src/
│   │   │   └── parsers/
│   │   │       └── typescript.ts  # Parser TS/JS detallado usando la TypeScript Compiler API
│   │   └── package.json           # Dependencias de Node.js
│   └── python/                    # Analizador sintáctico multilinguaje (Python, Java, Go, Rust, C#, Kotlin, Swift)
│       ├── main.py                # Bucle y protocolo JSON-Lines de comunicación por StdIn/StdOut
│       ├── language_registry.py   # Registro y mapeo de extensiones soportadas
│       ├── requirements.txt       # Dependencias de Python (tree-sitter-language-pack, networkx)
│       └── parsers/
│           ├── go.py              # Parser detallado de Go utilizando Tree-Sitter (corregido para imports simples)
│           ├── java.py            # Parser detallado de Java utilizando Tree-Sitter
│           ├── rust.py            # Parser detallado de Rust utilizando Tree-Sitter
│           ├── python.py          # Parser detallado de Python utilizando Tree-Sitter (extrae tipos anotados de atributos de instancia)
│           ├── csharp.py          # Parser detallado de C# utilizando Tree-Sitter
│           ├── kotlin.py          # Parser detallado de Kotlin utilizando Tree-Sitter
│           └── swift.py           # Parser detallado de Swift utilizando Tree-Sitter
├── src/                           # Frontend de la aplicación (React + TypeScript + Vite)
│   ├── App.tsx                    # Vista / Layout principal de la UI
│   ├── main.tsx                   # Inicialización de React
│   ├── components/                # Componentes interactivos de UI (Dashboards, Grafos, etc.)
│   └── stores/                    # Gestores de estado cliente (Zustand)
└── tests/                         # Suites de pruebas de integración E2E y de contratos
    ├── test_worker_contract.py    # Test que valida el protocolo JSON-Lines de los workers externos
    ├── test_analyze_project.py    # Test del pipeline de escaneo, límites de tamaño, exclusiones y cancelación
    ├── test_resolved_imports.py   # Test de validación detallada de resolución de imports absolutos (Java, Go, Rust)
    ├── test_antipatterns.py       # Test de verificación de antipatrones (God Module, Circular Dependency, Layer Violation)
    ├── test_c4_diagrams.py        # Test de verificación de diagramas C4 (Niveles 1, 2, 3, 4 y subgrafo de circulares)
    ├── test_supplementary_diagrams.py # Test de Package Diagram, Inheritance Tree y ER Diagram
    └── test_ai_integration.py     # Test de compilación + AiClient::ask real en modo Mock (fallback, prompt, respuesta)
```

---

## 🛠️ Detalle de Implementación y Estado de Componentes

### 1. Backend Core (Rust + Tauri) — **100% Completado y Funcional**

* **Modelos AMG (`amg.rs`)**: Se reflejó la especificación completa en tipos nativos Rust con soporte serde (camelCase) derivado para su comunicación transparente con el frontend.
* **Detección de Proyectos (`project_detector.rs`)**: Identifica el `ProjectType` analizando la presencia de marcadores de framework y archivos de configuración (Tauri, React Native, Electron, etc.) y calcula el mix de lenguajes.
* **Detección de Estilos de Arquitectura (`aggregator.rs`)**: Detecta estilos como `Layered` o `Hexagonal` evaluando la presencia de convenciones de directorios clave de forma global en todo el proyecto (corregido para evitar falsos negativos que ocurrían al evaluar la condición por módulo individual en vez de a nivel de proyecto).
* **Caché Persistente (`cache.rs`)**: Basado en `sled`, calcula el hash SHA-256 de los archivos antes de enviarlos a los workers. Si el hash coincide con uno previo, recupera el análisis en milisegundos sin coste de procesamiento de AST.
* **Cancelación Cooperativa (`analysis.rs`)**: `CancellationRegistry` + comando `cancel_analysis` permiten abortar un análisis en curso entre chunks de procesamiento (no a mitad de un batch en vuelo), devolviendo un resultado parcial marcado con `cancelled: true`.
* **Resolución de rutas de workers**: `NodeWorkerManager`/`PythonWorkerManager` resuelven la ruta a sus scripts (`workers/node/dist/index.js`, `workers/python/main.py`) de forma absoluta vía `CARGO_MANIFEST_DIR`, evitando que dependan del directorio de trabajo variable del proceso en distintos modos de ejecución.
* **Resolución de Imports Absolutos (`aggregator.rs`)**:
  * **Java**: Traduce imports de paquetes (`com.example.service.UserService`) y los resuelve contra archivos específicos usando las raíces de fuentes detectadas en `pom.xml`/`build.gradle` (parseo XML real + fallback a convención estándar `src/main/java`).
  * **Go**: Mapea imports lógicos de módulos (`mymodule/pkg/service`) a nivel de carpeta/paquete, resolviéndolos a todos los archivos que pertenecen a ese paquete, vía `go.mod`.
  * **Rust**: Resuelve imports `use crate::...` o `use my_crate::...` identificando el crate origen (`Cargo.toml`) y mapeando tanto la sintaxis moderna (`helper.rs`) como clásica (`helper/mod.rs`).
* **Métricas Globales**: Calcula acoplamiento Aferente ($Ca$), Eferente ($Ce$), Instabilidad ($I = Ce / (Ca + Ce)$), Cohesión de Módulo (`Ce / total_imports`) y la Distancia a la Secuencia Principal ($D = |A + I - 1|$).
* **Ciclos de Dependencia**: Implementa el algoritmo SCC de Tarjan para detectar componentes fuertemente conexas, más un DFS adicional para extraer la ruta exacta (`cycle_path`) de cada ciclo, normalizada por rotación lexicográfica para consolidar duplicados.
* **Detección de Antipatrones de Arquitectura (`aggregator.rs`)**:
  * **God Module**: Módulos con $Ce > 15$ o que concentran $> 20\%$ de todas las dependencias del proyecto.
  * **Circular Dependency**: Ciclos reales extraídos vía Tarjan + DFS, con rutas completas (`cycle_path`), normalización rotacional y punto de ruptura sugerido.
  * **Layer Violation**: Diseño híbrido — clasifica el nivel/rango del módulo primero por su `ModuleType` (fuente de verdad alineada con la UI), y si es `Unknown` o no mapeado, aplica fallback por coincidencia de palabras clave en carpetas.
* **Generación de Diagramas C4 (`c4_generator.rs`)** — **Niveles 1 a 4 completos**:
  * **Inferencia de Elementos**: Detecta `Actor` (Admin User / Public User / User) por presencia de controladores, y `ExternalSystem` (APIs HTTP, bases de datos) acumulando los `external_calls` reales emitidos por los workers Python y Node.
  * **Nivel 1 (Contexto)**: Mapa del sistema central interactuando con actores y sistemas externos.
  * **Nivel 2 (Contenedores)**: Infiere unidades desplegables dinámicas (ej. para Tauri crea Frontend SPA y Core Engine Backend).
  * **Nivel 3 (Componentes)**: Desglosa cada contenedor en sus módulos constituyentes y sus relaciones de dependencia.
  * **Nivel 4 (Código / UML bajo demanda)**: `generate_module_code_diagram` transforma las clases (`ClassInfo`) e interfaces de un módulo individual en subgrafos UML con sus herencias (`extends`/`implements`) — resolución intencionalmente limitada al propio módulo (ver Inheritance Tree para resolución cross-módulo).
  * **Diagrama Suplementario de Módulos Circulares**: Reutiliza los `cycle_path` exactos de los antipatrones ya detectados (Tarjan + DFS), en vez de una heurística de Ce/Ca separada que podía desincronizarse de la lista de antipatrones real.
* **Diagramas Suplementarios Adicionales (`supplementary_diagrams.rs`)** — **Completo**:
  * **Package Diagram**: Agrupa módulos por directorio contenedor completo (jerarquía completa, no solo el segmento inmediato — corregido para que sub-paquetes anidados como `services/billing` y `services/shipping` no aparezcan como paquetes sin relación entre sí) y agrega las dependencias cruzadas entre paquetes.
  * **Inheritance Tree**: Construye la jerarquía de herencia (`extends`/`implements`) a nivel de **todo el proyecto**, resolviendo relaciones cross-módulo (clase base e hija en archivos distintos) — a diferencia del Nivel 4 de C4, que es intra-módulo por diseño.
  * **ER Diagram**: Identifica entidades (`ModuleType::Model` o carpetas `models/`/`entities/`/`domain/`) y detecta relaciones por coincidencia de tipo de atributo contra nombres de entidad conocidos.
* **Integración de IA Local (`ai_client.rs`)** — **Completo (Mock verificado; Ollama/OpenAI-Compatible reales sin probar contra servidor real)**:
  * **`AiConfig` flexible**: soporta proveedor `Ollama` (default, `http://localhost:11434`), `OpenAiCompatible` (LM Studio, vLLM, cualquier endpoint compatible) y `Mock` (modo de prueba/offline, sin red).
  * **`check_ai_status`**: ping ligero (timeout 5s) a `/api/tags` (Ollama) o `/models` (OpenAI-Compatible) para reportar si el servidor está online y qué modelos hay disponibles.
  * **`build_prompt`**: construye system+user prompt inyectando contexto real del AMG según 3 modos — `FullAmg` (métricas globales, estilo, antipatrones), `ModuleDetail` (clases, acoplamiento, imports de un módulo puntual) y `AntipatternDetail` (descripción, ruta de ciclo, sugerencia de refactor de un antipatrón puntual).
  * **`ask`**: envía la consulta real vía `/api/chat` (Ollama) o `/chat/completions` (OpenAI-Compatible) con timeout configurable (default 60s); si el proveedor es `Mock` o el servidor no responde, retorna un **fallback elegante** — respuesta estructurada marcada explícitamente (`isMockFallback: true`) que incluye el contexto ya construido, para que la UI y las pruebas nunca se rompan por falta de un LLM corriendo.
  * **Modo CLI de testing (`--ask-ai-mock <prompt>`)**: ejercita `AiClient::ask` en modo `Mock` de forma aislada (sin Tauri, sin workers, sin red), permitiendo verificar el flujo real de construcción de prompt y respuesta sin depender de infraestructura externa.

### 2. Capa de Workers AST (Node.js & Python) — **100% Completado y Funcional**

* **Protocolo de comunicación**: Basado en JSON-Lines a través de StdIn y StdOut estándar. Implementa chunking de archivos e hilos paralelos de monitoreo.
* **Worker Node**: Compilado y listo para analizar código TypeScript y JavaScript.
* **Worker Python**: Emplea `tree-sitter-language-pack` para parsear Python, Java, Kotlin, C#, Swift, Go y Rust de forma nativa sin requerir descargas ni compilaciones en tiempo de ejecución.
* **Corrección Go**: Se ajustó `parsers/go.py` para permitir la correcta extracción sintáctica de imports escritos en una sola línea.
* **Corrección Python — tipos de atributos anotados**: `parsers/python.py` ahora extrae el tipo real de atributos de instancia con anotación explícita (`self.x: Tipo = valor`), en vez de reportar siempre `"any"`. Esto habilita relaciones precisas en el ER Diagram y cualquier otro consumidor que dependa de `AttributeInfo.type`.

### 3. Suite de Pruebas (Python E2E) — **100% Verificado e Integrado**

* **Contratos (`test_worker_contract.py`)**: Valida que los comandos `parse` y `analyze` funcionen correctamente en los workers y cumplan la especificación.
* **Pipeline General (`test_analyze_project.py`)**: Verifica que `cargo check` compile, que el sistema ignore adecuadamente según `.gitignore` y carpetas típicas (`node_modules`), filtre archivos de más de 1MB, y aplique la **cancelación cooperativa** abortando entre chunks (usando el binario real vía `--analyze-project-json --cancel-after-ms`).
* **Resoluciones (`test_resolved_imports.py`)**: Genera un monorepo temporal con módulos en Java, Go y Rust y afirma que cada import absoluto se asocia correctamente a su nodo destino en el AMG.
* **Antipatrones (`test_antipatterns.py`)**: Valida la generación e identificación exacta de ciclos (con `cycle_path`), violaciones de capas en estilo Layered, y módulos gigantes.
* **Diagramas C4 (`test_c4_diagrams.py`)**: Valida la inferencia de actores, sistemas externos, contenedores, y los Niveles 1-3 de diagramas C4 con sus relaciones.
* **Diagramas Suplementarios (`test_supplementary_diagrams.py`)**: Valida Package Diagram (incluyendo agrupación correcta de sub-paquetes anidados), Inheritance Tree (incluyendo resolución de herencia cross-módulo), y ER Diagram (incluyendo relaciones por tipo de atributo anotado).
* **Integración de IA (`test_ai_integration.py`)**: Verifica compilación con `reqwest`, que `analyze_project` no sufrió regresiones, y ejecuta `AiClient::ask` REAL en modo `Mock` (vía `--ask-ai-mock`) validando `isMockFallback`, `providerUsed`, contenido de respuesta no vacío, y que el prompt del usuario se refleje en `generatedPrompt`.

---

## 🗺️ Estado del Roadmap de Diagramas (§4.4.1–§4.4.9, 19 vistas totales)

| #   | Diagrama                                          | Estado　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| -----| ---------------------------------------------------| --------------------------------------------------------------------------------------------------|
| 1   | Contexto del Sistema (C4 Nivel 1)                 | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 2   | Contenedores (C4 Nivel 2)                         | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 3   | Componentes (C4 Nivel 3)                          | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 4   | Código / UML de Módulo (C4 Nivel 4, bajo demanda) | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 5   | Módulos Circulares                                | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 6   | Diagrama de Paquetes                              | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 7   | Árbol de Herencia                                 | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 8   | Diagrama Entidad-Relación                         | ✅ Backend　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 9   | Mapa de Calor de Acoplamiento (Coupling Matrix)   | ❓ Por confirmar si ya existe una fuente de datos dedicada　　　　　　　　　　　　　　　　　　　　|
| 10  | Deployment Diagram                                | ❓ Alcanzable con datos actuales (`docker-compose.yml`/k8s), sin decisión tomada aún　　　　　　　|
| 11  | Árbol de Directorios (File Tree)                  | 🎨 Frontend puro, sin trabajo de Rust pendiente　　　　　　　　　　　　　　　　　　　　　　　　　|
| 12  | Mapa de Carpetas (Treemap D3)                     | 🎨 Frontend puro　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| 13  | Línea de Tiempo de Evolución                      | 🎨 Frontend + snapshots ya cacheados en sled　　　　　　　　　　　　　　　　　　　　　　　　　　 |
| 14  | Mapa de Calor de Contribuciones (Ownership)       | 🎨 Frontend + `git log`/`git blame`　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 15  | Dynamic Diagram                                   | ⏸️ Bloqueado: requiere `invocations` (call graph), que ningún parser emite todavía　　　　　　　　|
| 16  | Call Graph                                        | ⏸️ Bloqueado: ídem　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 17  | Diagrama de Secuencia                             | ⏸️ Bloqueado: ídem　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　|
| 18  | Diagrama de Flujo de Datos (DFD)                  | ⏸️ Bloqueado: ídem, más seguimiento de flujo de variables　　　　　　　　　　　　　　　　　　　　 |
| 19  | System Landscape                                  | ❓ Requiere soporte multi-proyecto, no implementado en `analyze_project` (recibe un único `path`) |

**Nota sobre los bloqueados (15-18)**: todos dependen de que los parsers AST extraigan `invocations` (qué función llama a qué función, no solo qué archivo importa a qué archivo). Hoy todos los parsers emiten `"invocations": []`. Implementarlo es un esfuerzo comparable al del resto del motor de agregación junto (resolución de llamadas por lenguaje, con las mismas ambigüedades de nombres que los imports pero multiplicadas por la frecuencia de nombres de método comunes). Se pospone deliberadamente hasta que haya señal real de demanda de estos diagramas específicos.

---

## 📈 Siguientes Hitos y Roadmap Técnico

Con la infraestructura core, la detección de antipatrones, el motor de diagramas C4 (Niveles 1-4), los Diagramas Suplementarios (Paquetes/Herencia/ER) y la Integración de IA Local (Mock verificado) finalizados y verificados con tests E2E, las siguientes fases de desarrollo implican:

1. **Desarrollo del Frontend (React + TS)** — **siguiente prioridad**: Reemplazar el layout por defecto de la interfaz con los paneles interactivos de SAAC v2.0, integrando el flujo de estados Zustand para mostrar las métricas, la lista de dependencias y el visor gráfico del AMG (incluyendo los diagramas 100% frontend: File Tree, Treemap, Timeline, Ownership Map) y la interfaz de consulta con `ask_ai`/`check_ai_status`.
2. **Cabos sueltos de diagramas** (bajo esfuerzo, opcional): confirmar/implementar Coupling Matrix Data y evaluar si Deployment Diagram entra en el alcance actual.
3. **Verificación de IA contra servidor real**: `check_ai_status`/`ask_ai` en modo `Ollama`/`OpenAiCompatible` compilan y siguen el diseño correcto, pero no se han probado contra un servidor LLM real corriendo en la máquina — pendiente cuando haya uno disponible para pruebas.
4. **(Futuro, sin priorizar)** Extracción de `invocations` por lenguaje, para desbloquear Call Graph, Secuencia, Dynamic Diagram y DFD.