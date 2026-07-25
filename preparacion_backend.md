# Plan de Implementación — Preparación del Backend de SAAC v2.0 (Pre-Frontend)

Este documento detalla el plan de diseño e implementación para los **6 módulos clave del backend en Rust** que deben quedar listos, probados y expuestos vía comandos IPC de Tauri antes de construir la interfaz completa en React.

---

## 📑 Índice de Módulos

1. [Módulo 1: Ignoración Configurable (`.saacignore` + Configuración por Proyecto)](#módulo-1-ignoración-configurable-saacignore--configuración-por-proyecto)
2. [Módulo 2: Terminal / Consola Interactiva & Emisión de Logs (`saac_console`)](#módulo-2-terminal--consola-interactiva--emisión-de-logs-saac_console)
3. [Módulo 3: Anotaciones, ADRs y Antipatrones Ignorados (`.saac/annotations.json`)](#módulo-3-anotaciones-adrs-y-antipatrones-ignorados-saacannotationsjson)
4. [Módulo 4: Motor de Reglas Arquitectónicas (Fitness Functions & Fitness Score)](#módulo-4-motor-de-reglas-arquitectónicas-fitness-functions--fitness-score)
5. [Módulo 5: Historial de Análisis, AnalysisRun y Versionado AMG (`AMGDelta`)](#módulo-5-historial-de-análisis-analysisrun-y-versionado-amg-amgdelta)
6. [Módulo 6: Configuración Global del Sistema (`global_config.json`)](#módulo-6-configuración-global-del-sistema-global_configjson)

---

## 1. Módulo 1: Ignoración Configurable (`.saacignore` + Configuración por Proyecto)

### 🎯 Objetivo
Permitir que el usuario excluya carpetas, archivos o extensiones del análisis sintáctico AST, tanto creando un archivo `.saacignore` en la raíz del proyecto analizado como especificando patrones de ignorados en la configuración.

### 🛠️ Diseño Técnico en Rust
* **Archivo de configuración del proyecto**: `.saac/config.json` en la raíz del proyecto.
* **Filtros en `ignore::WalkBuilder`**:
  1. Activar `.add_custom_ignore_filename(".saacignore")` en `WalkBuilder`.
  2. Aplicar patrones `OverrideBuilder` en Rust para incluir/excluir rutas según `.saac/config.json`.
* **Filtro explícito de extensiones**: `ignore_extensions: Vec<String>` (ej. `["*.min.js", "*.map", "*.generated.ts"]`).

### 🔌 Comandos Tauri Expuestos
- `get_project_config(projectPath: string) -> ProjectConfig`
- `update_project_config(projectPath: string, config: ProjectConfig) -> ProjectConfig`

---

## 2. Módulo 2: Terminal / Consola Interactiva & Emisión de Logs (`saac_console`)

### 🎯 Objetivo
Proporcionar un inspector de logs en tiempo real y un terminal de comandos propios de SAAC (`saac> `) que no depende de consolas del SO (`cmd.exe`/`bash`), permitiendo ejecutar acciones internas rápidamente.

### 🛠️ Diseño Técnico en Rust
* **Emisor de Logs**: Sistema de canal de eventos Tauri que emite `project://log` con payloads:
  ```typescript
  interface LogEvent {
    level: 'info' | 'warn' | 'error' | 'debug';
    timestamp: string;
    target: string;
    message: string;
  }
  ```
* **Intérprete de Comandos Internos (`src-tauri/src/engine/console.rs`)**:
  - `help` -> Retorna lista de comandos soportados con descripciones.
  - `analyze [path]` -> Dispara análisis.
  - `cancel` -> Cancela el análisis activo.
  - `ai status` -> Llama `check_ai_status`.
  - `ai ask <prompt>` -> Llama `ask_ai`.
  - `rules check` -> Evalúa las Fitness Functions contra el último AMG.
  - `ignore add <pattern>` -> Agrega patrón a `.saacignore`.
  - `clear` -> Notifica a la UI que limpie el buffer de log.

### 🔌 Comandos Tauri Expuestos
- `execute_console_command(command: string, projectPath?: string) -> ConsoleCommandOutput`

---

## 3. Módulo 3: Anotaciones, ADRs y Antipatrones Ignorados (`.saac/annotations.json`)

### 🎯 Objetivo
Permitir que los arquitectos documenten decisiones (ADRs), anoten elementos del modelo y marquen antipatrones como "Ignorados" (con justificación escrita), de modo que persistan entre sesiones de análisis.

### 🛠️ Diseño Técnico en Rust
* **Persistencia**: Archivo JSON local `.saac/annotations.json` por proyecto.
* **Estructura de Datos (`src-tauri/src/engine/annotations.rs`)**:
  - `Annotation`: `{ id, targetId, targetType, title, content, author, createdAt }`
  - `Adr`: `{ id, number, title, status: "Proposed"|"Accepted"|"Rejected"|"Deprecated", context, decision, consequences, date }`
  - `IgnoredAntipattern`: `{ antipatternId, ignoredAt, justification, author }`
  - `Risk`: `{ id, title, severity: "Low"|"Medium"|"High"|"Critical", description, mitigation, affectedModuleIds }`

### 🔌 Comandos Tauri Expuestos
- `load_project_annotations(projectPath: string) -> ProjectAnnotations`
- `add_annotation(projectPath: string, annotation: Annotation) -> ProjectAnnotations`
- `add_adr(projectPath: string, adr: Adr) -> ProjectAnnotations`
- `ignore_antipattern(projectPath: string, antipatternId: string, justification: string) -> ProjectAnnotations`
- `add_risk(projectPath: string, risk: Risk) -> ProjectAnnotations`

---

## 4. Módulo 4: Motor de Reglas Arquitectónicas (Fitness Functions & Fitness Score)

### 🎯 Objetivo
Evaluar el cumplimiento del código respecto a las reglas arquitectónicas definidas en `.saac/rules.yaml` (o un conjunto estándar por defecto) y calcular una puntuación global de salud de la arquitectura **Fitness Score (0-100)**.

### 🛠️ Diseño Técnico en Rust (`src-tauri/src/engine/rules.rs`)
* **Formato de Reglas (`.saac/rules.yaml`)**:
  ```yaml
  rules:
    - id: "no-god-modules"
      name: "Sin Módulos Gigantes"
      severity: "critical"
      weight: 25
      condition: "max_ce <= 15"
    - id: "no-circular-deps"
      name: "Sin Dependencias Circulares"
      severity: "critical"
      weight: 35
      condition: "cyclic_dependency_count == 0"
    - id: "layer-architecture"
      name: "Respetar Capas Definidas"
      severity: "high"
      weight: 20
      condition: "layer_violation_count == 0"
    - id: "maintainability-threshold"
      name: "Índice de Mantenibilidad Promedio"
      severity: "medium"
      weight: 20
      condition: "maintainability_index_avg >= 65"
  ```
* **Evaluación**: El evaluador recorre el `ArchitectureModelGraph` cargado y calcula el cumplimiento de cada regla.
* **Fitness Score**: Puntuación de 0 a 100 basada en la suma ponderada de las reglas aprobadas.

### 🔌 Comandos Tauri Expuestos
- `evaluate_fitness_rules(projectPath: string, amg?: ArchitectureModelGraph) -> FitnessEvaluationResult`

---

## 5. Módulo 5: Historial de Análisis, AnalysisRun y Versionado AMG (`AMGDelta`)

### 🎯 Objetivo
Mantener una línea de tiempo inmutable de los análisis realizados (`AnalysisRun`) en la base de datos `sled` (`.saac/cache_db`) y calcular diferencias del de arquitectura (**`AMGDelta`**) entre dos ejecuciones.

### 🛠️ Diseño Técnico en Rust (`src-tauri/src/engine/history.rs`)
* **Snapshotting**: Guardar cada `ArchitectureModelGraph` generado en `sled` indexado por `analysis_run_id` y timestamp.
* **Cálculo de AMGDelta**: Compara dos AMGs (`run_a` y `run_b`):
  - `added_modules: Vec<String>`
  - `removed_modules: Vec<String>`
  - `modified_modules: Vec<String>`
  - `added_dependencies: Vec<Dependency>`
  - `removed_dependencies: Vec<Dependency>`
  - `metrics_diff`: Cambios en LOC, Mantenibilidad, Antipatrones y Fitness Score.

### 🔌 Comandos Tauri Expuestos
- `get_analysis_history(projectPath: string) -> Vec<AnalysisRunSummary>`
- `compare_analysis_runs(projectPath: string, runIdA: string, runIdB: string) -> AMGDelta`

---

## 6. Módulo 6: Configuración Global del Sistema (`global_config.json`)

### 🎯 Objetivo
Gestionar las preferencias globales de la aplicación SAAC (servidor Ollama, modelo por defecto, hilos máximos de workers, tema visual, etc.) persistidas en el directorio de AppData del sistema.

### 🛠️ Diseño Técnico en Rust (`src-tauri/src/engine/global_config.rs`)
* **Ubicación de almacenamiento**: `%APPDATA%/saac/global_config.json` (en Windows) / `~/.saac/global_config.json`.
* **Estructura `GlobalConfig`**:
  ```rust
  pub struct GlobalConfig {
      pub ai_provider: String,        // "ollama" | "openai" | "mock"
      pub ai_endpoint: String,        // "http://localhost:11434"
      pub ai_default_model: String,   // "qwen3:4b"
      pub max_worker_threads: usize,  // Default: num_cpus
      pub default_theme: String,      // "dark" | "light" | "system"
      pub auto_check_ai: bool,
  }
  ```

### 🔌 Comandos Tauri Expuestos
- `get_global_config() -> GlobalConfig`
- `update_global_config(config: GlobalConfig) -> GlobalConfig`

---

## 🧪 Estado de Implementación Backend Pre-Frontend — **100% COMPLETADO**

Todos los 6 módulos backend han sido implementados en Rust, registrados como comandos IPC en Tauri y verificados sintáctica y funcionalmente con la suite de pruebas E2E `tests/test_pre_frontend_backend.py`:

- ✅ **Módulo 1 (`project_config.rs`)**: Ignoración de `.saacignore` y patrones en `WalkBuilder` + `.saac/config.json`.
- ✅ **Módulo 2 (`console.rs`)**: Intérprete de comandos de la Consola SAAC (`saac> `) y emisión de log events.
- ✅ **Módulo 3 (`annotations.rs`)**: Persistencia de anotaciones, ADRs, riesgos y antipatrones ignorados en `.saac/annotations.json`.
- ✅ **Módulo 4 (`rules.rs`)**: Motor de reglas de arquitectura y cálculo configurable de Fitness Score (0-100) en `.saac/rules.json`.
- ✅ **Módulo 5 (`history.rs`)**: Snapshots inmutables de ejecuciones de análisis en `.saac/history.json` y cálculo de deltas `AMGDelta`.
- ✅ **Módulo 6 (`global_config.rs`)**: Persistencia de la configuración global de usuario en `%APPDATA%/saac/global_config.json`.
- ✅ **Comando Nivel 4 (`get_module_code_diagram`)**: Expuesto como comando Tauri para drill-down de UML de módulo bajo demanda.
