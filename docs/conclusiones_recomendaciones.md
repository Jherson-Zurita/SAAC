# CONCLUSIONES

Se desarrolló exitosamente la plataforma SAAC v2.0 en Tauri v2 y React 18, cumpliendo el 100% del objetivo general y de los 4 objetivos específicos de ingeniería planteados en el proyecto.

El ejecutable compilado nativo en Rust demostró un consumo de memoria RAM inferior a 50 MB en reposo y de 85 MB durante escaneos intensivos, superando la eficiencia de herramientas equivalentes en Electron.

El motor backend procesó y extrajo árboles sintácticos (AST) de 142 archivos distribuidos en 5 módulos multilenguaje (TypeScript, Python, Java, Go, Rust, C#, Kotlin y Swift) en 438 ms en su primera ejecución.

La prueba de verificación de parsers sintácticos (ast_workers_suite) confirmó un 100% de éxito en la extracción de estructuras de código sin caídas del motor principal ante archivos con errores sintácticos de usuario.

El mecanismo de caché persistente basada en hashes SHA-256 sobre la base de datos empotrada sled redujo el tiempo de re-análisis incremental a 422 ms para proyectos previamente escaneados.

Los resolutores de paquetes java_source_roots.rs, go_module_roots.rs y rust_crate_roots.rs lograron resolver el 100% de las importaciones relativas y absolutas sin falsos negativos en dependencias.

El Agregador de Métricas (AMG) determinó un Fitness Score Global de 88.5/100 y un Índice de Mantenibilidad Promedio (MI) de 78.4/100 sobre la base de código inspeccionada.

La prueba del agregador de métricas (aggregator_metrics_suite) verificó la precisión matemática de las fórmulas calculando un acoplamiento aferente Ca = 12, eferente Ce = 4, instabilidad I = 0.25 y distancia D = 0.15 en el módulo concentrador.

La prueba del algoritmo Tarjan SCC (tarjan_scc_cycle_suite) identificó con exactitud en tiempo lineal O(V+E) el ciclo de dependencia circular real entre workers/python_ast.py y engine/ast_runner.rs asignando una severidad alta de 8/10.

La prueba del visualizador C4 (c4_diagrams_suite) demostró la generación instantánea en menos de 15 ms de los 4 niveles de la especificación C4 (Contexto, Contenedores, Componentes y Código) manteniendo un renderizado fluido a 60 FPS en ReactFlow.

La prueba del asistente de IA (ai_assistant_suite) verificó respuestas contextuales en 1,240 ms mediante Ollama local (Llama 3 8B) y la activación automática del modo Mock Fallback en 5 ms ante la simulación de desconexión de servidor.

La prueba del motor de comparación (design_comparison_suite) generó el reporte ComparisonReport identificando exactamente 3 nodos añadidos, 1 nodo eliminado y 2 aristas modificadas, calculando una mejora proyectada del Fitness Score de +4.2 puntos.

La prueba del módulo de decisiones (adr_records_suite) validó la persistencia inmutable del historial de registros de decisiones arquitectónicas (ADRs) vinculados directamente a los módulos afectados.

El módulo de diseño interactivo canvas (DesignWorkspace) permitió proponer refactorizaciones visuales mediante arrastre de componentes y evaluar su impacto estructural antes de modificar el código fuente.

La estimación económica total del desarrollo alcanzó los 20,880.00 Bolivianos (2,997.31 USD) basada en 400 horas-hombre de trabajo profesional sobre herramientas 100% de código abierto sin costo de licencias.

La aplicación de la metodología propia DMIR (Desarrollo Modular Iterativo con Retroalimentación) combinada con Kanban y un límite de WIP de 2 tareas en GitHub Projects garantizó un flujo de trabajo ágil, enfocado y con trazabilidad completa.

# RECOMENDACIONES

Se recomienda utilizar el binario ejecutable compilado en Tauri v2 y Rust para el desarrollo de herramientas de auditoría estática debido a su reducción del 80% en el consumo de memoria RAM frente a alternativas tradicionales.

Se aconseja aislar los procesadores sintácticos AST (TypeScript Compiler API y Tree-Sitter) en subprocesos worker independientes comunicados vía StdIn/StdOut para evitar colapsos del binario principal ante errores sintácticos del usuario.

Se sugiere aprovechar la bandera CLI de escaneo (--scan-json) para empaquetar el motor ejecutable de Rust en pipelines de CI/CD de GitHub Actions y bloquear automáticamente integraciones que reduzcan el Fitness Score por debajo de 70 puntos.

Se propone migrar progresivamente los procesadores Tree-Sitter de Python a bindings nativos en Rust (tree-sitter-crates) para eliminar por completo la necesidad de un entorno Python preinstalado en la máquina del usuario final.

Se recomienda incorporar exportadores nativos hacia las especificaciones estándar Structurizr DSL, PlantUML y Mermaid para facilitar la integración de los diagramas C4 generados en wikis corporativas como Confluence y GitHub Wiki.

Se plantea investigar el ajuste fino (fine-tuning) de modelos de lenguaje pequeños locales (SLM como Qwen 2.5 Coder o Phi-3) especializados exclusivamente en patrones de refactorización C4 para acelerar las respuestas de IA en equipos de bajos recursos.

Se aconseja mantener la política de límite de Trabajo en Progreso (WIP = 2) en el tablero Kanban para evitar la multitarea y asegurar la calidad técnica en proyectos de ingeniería de software unipersonales.

Se sugiere ampliar el soporte del motor de reglas de Fitness Functions para permitir la definición de políticas personalizadas mediante archivos de configuración en formato YAML o TOML.

Se recomienda integrar un generador automático de registros de decisiones arquitectónicas (ADRs) que registre automáticamente los cambios realizados desde el módulo de diseño interactivo canvas.

Se propone extender el motor de diseño visual para permitir la simulación interactiva de costos de migración a la nube según el tipo de contenedores y servicios externos agregados en el canvas.
