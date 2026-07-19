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
│   ├── Cargo.toml                 # Dependencias (tauri, sled, sha2, chrono, quick-xml, etc.)
│   └── src/
│       ├── main.rs                # Punto de entrada de la aplicación y soporte de CLI para test
│       ├── lib.rs                 # Inicialización de workers, registro de comandos y ciclo de vida
│       ├── commands/              # Comandos Tauri expuestos al frontend
│       │   ├── mod.rs             # Declaración y exportación de comandos
│       │   ├── analysis.rs        # Orquestación de escaneo, workers, caché, agregador y cancelación
│       │   ├── project.rs         # Placeholders para manejo e inicialización de proyectos
│       │   └── ai.rs              # Placeholders para integración de LLM (Ollama)
│       ├── engine/                # Núcleo y motor de análisis arquitectónico
│       │   ├── mod.rs             # Declaración de submódulos del motor
│       │   ├── amg.rs             # Modelos de datos del Grafo del Modelo de Arquitectura (AMG) en Rust
│       │   ├── aggregator.rs      # Resolución de imports, cálculo de acoplamiento (Ca/Ce/I/D/Cohesión) y ciclos (Tarjan)
│       │   ├── project_detector.rs# Inferencia de tipo de proyecto (Desktop, Mobile, etc.) y lenguajes dominantes
│       │   ├── cache.rs           # Sistema de almacenamiento incremental y lectura en base de datos sled
│       │   ├── java_source_roots.rs# Extractor de raíces fuente Java mediante pom.xml y build.gradle
│       │   ├── go_module_roots.rs  # Extractor de paths lógicos de módulos Go mediante go.mod
│       │   └── rust_crate_roots.rs # Extractor de estructura de crates Rust mediante Cargo.toml
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
│           ├── python.py          # Parser detallado de Python utilizando Tree-Sitter
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
    ├── test_analyze_project.py    # Test del pipeline de escaneo, límites de tamaño, exclusions y cancelación
    └── test_resolved_imports.py   # Test de validación detallada de resolución de imports absolutos (Java, Go, Rust)
```

---

## 🛠️ Detalle de Implementación y Estado de Componentes

### 1. Backend Core (Rust + Tauri) - **100% Completado y Funcional**
* **Modelos AMG (`amg.rs`)**: Se reflejó la especificación completa en tipos nativos Rust con soporte serde (camelCase) derivado para su comunicación transparente con el frontend.
* **Detección de Proyectos (`project_detector.rs`)**: Identifica el `ProjectType` analizando la presencia de marcadores de framework y archivos de configuración (Tauri, React Native, Electron, etc.) y calcula el mix de lenguajes.
* **Caché Persistente (`cache.rs`)**: Basado en `sled`, calcula el hash SHA-256 de los archivos antes de enviarlos a los workers. Si el hash coincide con uno previo, recupera el análisis en milisegundos sin coste de procesamiento de AST.
* **Resolución de Imports Absolutos (`aggregator.rs`)**:
  * **Java**: Traduce imports de paquetes (`com.example.service.UserService`) y los resuelve contra archivos específicos usando las raíces de fuentes detectadas en `pom.xml`/`build.gradle`.
  * **Go**: Mapea imports lógicos de módulos (`mymodule/pkg/service`) a nivel de carpeta/paquete, resolviéndolos a todos los archivos que pertenecen a ese paquete.
  * **Rust**: Resuelve imports `use crate::...` o `use my_crate::...` identificando el crate origen y mapeando tanto la sintaxis moderna (`helper.rs`) como clásica (`helper/mod.rs`).
* **Métricas Globales**: Calcula acoplamiento Aferente ($Ca$), Eferente ($Ce$), Instabilidad ($I = Ce / (Ca + Ce)$), Cohesión de Módulo (`Ce / total_imports`) y la Distancia a la Secuencia Principal ($D = |A + I - 1|$).
* **Ciclos de Dependencia**: Implementa el algoritmo SCC de Tarjan para detectar componentes fuertemente conexas formadas por ciclos en el grafo interno de dependencias.

### 2. Capa de Workers AST (Node.js & Python) - **100% Completado y Funcional**
* **Protocolo de comunicación**: Basado en JSON-Lines a través de StdIn y StdOut estándar. Implementa chunking de archivos e hilos paralelos de monitoreo.
* **Worker Node**: Compilado y listo para analizar código TypeScript y JavaScript.
* **Worker Python**: Emplea `tree-sitter-language-pack` para parsear Python, Java, Kotlin, C#, Swift, Go y Rust de forma nativa sin requerir descargas ni compilaciones en tiempo de ejecución.
* **Corrección Go**: Se ajustó `parsers/go.py` para permitir la correcta extracción sintáctica de imports escritos en una sola línea.

### 3. Suite de Pruebas (Python E2E) - **100% Verificado e Integrado**
* **Contratos (`test_worker_contract.py`)**: Valida que los comandos `parse` y `analyze` funcionen correctamente en los workers y cumplan la especificación.
* **Pipeline General (`test_analyze_project.py`)**: Verifica que `cargo check` compile, que el sistema ignore adecuadamente según el archivo `.gitignore` y carpetas típicas (`node_modules`), filtre archivos de más de 1MB y aplique la **cancelación cooperativa** abortando entre batches.
* **Resoluciones (`test_resolved_imports.py`)**: Suite de pruebas específica que genera un monorepo temporal con módulos en Java, Go y Rust, ejecuta el análisis completo del backend y afirma que cada import absoluto se asocie de forma idéntica a su nodo destino correspondiente en el AMG.

---

## 📈 Siguientes Hitos y Roadmap Técnico

Con el motor y la infraestructura core finalizados, las siguientes fases de desarrollo implican:
1. **Detección de Antipatrones de Arquitectura**: Programar las heurísticas específicas para identificar `God Module` (módulos gigantes), `Layer Violation` (capas importando niveles superiores) y `Circular Dependencies` (usando el conteo de ciclos de Tarjan).
2. **Generación de C4 Diagrams**: Diseñar la lógica para mapear los módulos agregados en vistas de contenedor y diagramas C4 dinámicos exportables.
3. **Integración con LLM Local (Ollama)**: Desarrollar el comando `ask_ai` para alimentar el AMG resultante en modelos de lenguaje locales para auditorías interactivas.
4. **Desarrollo del Frontend (React + TS)**: Reemplazar el layout por defecto de la interfaz con los paneles interactivos de SAAC v2.0, integrando el flujo de estados Zustand para mostrar las métricas, la lista de dependencias y el visor gráfico del AMG.
