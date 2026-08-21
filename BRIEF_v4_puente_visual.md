# Brief técnico v4 — Puente Visual del Capítulo 4 (prioridades finales pre-entrega)

## Contexto para la IA que ejecuta esta tarea

Estás trabajando sobre el repositorio real de **SAAC v2.0**, con acceso de lectura a `src-tauri/`, `src/`, `workers/`, `shared/types.ts` y `tests/`.

Ya existe una versión del Capítulo 4 (adjunta) que fue revisada dos veces por el tutor de tesis. Su retroalimentación más reciente se resume en una sola frase:

> **"No me demuestres solamente mediante texto que SAAC funciona; muéstrame visualmente dónde está implementada cada funcionalidad dentro de la arquitectura, cómo interactúan sus componentes, qué entradas reciben, qué procesan, qué salidas producen y cómo las pruebas verifican cada integración."**

Confirmación explícita del tutor: **el contenido textual ya está bien y no necesita reescritura.** El problema es puramente de representación visual — falta el "puente" gráfico entre lo que el texto describe y cómo se ve dentro del sistema real. Por lo tanto, esta tarea es de **añadir diagramas Mermaid nuevos y reorganizar figuras existentes**, no de reescribir prosa.

**Regla de oro de siempre: no inventar nada que no puedas verificar en el repo.** Todos los diagramas Mermaid deben construirse a partir de nombres de archivo, funciones y estructuras reales — si algo no se puede confirmar, usar una etiqueta genérica en el diagrama en vez de inventar un nombre específico.

---

## Las 4 prioridades exactas para esta entrega (en orden de importancia)

### Prioridad 1 — Diagrama de Componentes Internos (nueva figura, sección nueva 4.2.3)

El tutor preguntó explícitamente *"la estructura de tu desarrollo, ¿dónde la tienes?"* y *"si pones un gráfico de la estructura de los componentes, ¿cómo interactúan entre sí?"*.

La Figura 4.1 actual (arquitectura en 5 capas) es válida pero es de alto nivel — responde "qué capas existen", no "qué archivo hace qué y cómo se llama entre sí".

**Qué construir:** Un diagrama Mermaid (`graph TD` o `flowchart TD`) de **componentes internos reales**, insertado como nueva sección **4.2.3 "Arquitectura de Componentes"**, inmediatamente después de 4.2.2. Debe mostrar, con nombres de archivo/módulo reales verificados en el repo:

- Frontend: `AppShell.tsx` → Zustand Stores → `tauri-api.ts`
- Conexión IPC hacia el backend
- Backend: `commands/` (comandos Tauri) → `engine/` con sus módulos reales desglosados individualmente (`aggregator.rs`, `amg.rs`, `c4_generator.rs`, `supplementary_diagrams.rs`, `ai_client.rs`, y cualquier otro módulo real de `engine/` que puedas confirmar)
- Conexión desde `engine/` hacia `workers/` (Node y Python)
- Conexión desde `aggregator.rs` hacia el AMG y las métricas resultantes, y de vuelta hacia el frontend vía ReactFlow

El nivel de detalle debe ser tal que, señalando cualquier punto del diagrama, se pueda identificar exactamente qué archivo del repo corresponde ahí — esa es literalmente la prueba de que resuelve la pregunta del tutor.

### Prioridad 2 — Diagrama de Flujo Global: Entrada → Procesamiento → Salida (nueva figura de cierre, sección nueva 4.8)

Esta es la figura síntesis que el tutor pidió de forma más insistente (repitió "¿cuáles son las entradas y cuáles son tus salidas? Básicamente eso es lo que necesitamos").

**Qué construir:** Un diagrama Mermaid de flujo (`flowchart TD`) al final del capítulo, en una nueva sección **4.8 "Síntesis de Integración del Sistema"**, que muestre el recorrido completo end-to-end de una sola operación de análisis, estructurado explícitamente en tres bloques rotulados:

- **ENTRADA**: ruta del proyecto, archivos fuente, configuración (`.saacignore`, `.saac/config.json`)
- **PROCESAMIENTO**: el recorrido secuencial real (verificación de caché SHA-256 → workers AST → Aggregator → cálculo de métricas y antipatrones → generación de diagramas → construcción de contexto para IA si aplica)
- **SALIDA**: `ProjectAnalysisResult`, AMG, métricas, antipatrones, diagramas C4/suplementarios, y opcionalmente la respuesta de IA

Usar subgrafos (`subgraph`) de Mermaid para delimitar visualmente los tres bloques (ENTRADA / PROCESAMIENTO / SALIDA), de forma que aunque se mire el diagrama sin leer el texto, la estructura de tres columnas o tres niveles ya comunique el flujo. Esta es la figura que, según el análisis del tutor, debe responder de un vistazo a "¿qué hace tu sistema?", "¿para qué sirve esto?" y "¿dónde se integra?" simultáneamente.

### Prioridad 3 — Mini-diagrama de integración para cada una de las 7 pruebas

El tutor fue explícito: no basta con "esto pasó", quiere ver *qué componente se prueba → qué entra → qué sale → cómo se integra*.

**Qué construir:** Para cada una de las 7 suites ya documentadas en la sección 4.7 (`test_worker_contract.py`, `test_analyze_project.py`, `test_resolved_imports.py`, `test_antipatterns.py`, `test_c4_diagrams.py`, `test_supplementary_diagrams.py`, `test_ai_integration.py`), insertar un pequeño diagrama Mermaid (`flowchart LR` o `flowchart TD`, tamaño reducido, 5-8 nodos máximo) **antes** del bloque de código de construcción de la prueba (parte "a" ya existente), mostrando el flujo mínimo: Fixture/Entrada → Componente(s) bajo prueba → Resultado(s) evaluado(s).

Ejemplos de qué nivel de detalle se espera (adaptar a lo que confirmes en cada test real, no copiar literal):
- Suite 1 (Workers): `test_worker_contract.py` → protocolo JSON-Lines → Node Worker / Python Worker → `AnalysisResult`
- Suite 4 (Antipatrones): Fixture → Aggregator (Tarjan SCC + reglas) → ramificación en God Module / Circular Dependency / Layer Violation → `AntipatternResult`
- Suite 7 (IA): Usuario → `AiChatPanel` → `tauri-api.ts` → `AiClient` → `build_prompt` + AMG → ramificación Ollama/Cloud/Mock → `AiResponse` → `MarkdownRenderer` → Usuario

Mantener intacta toda la estructura ya existente de cada prueba (a) Construcción, b) Salida de consola real, c) Incidencias y correcciones) — el mini-diagrama se añade como paso previo a esas tres partes, no las reemplaza.

### Prioridad 4 — Formato consistente de TODAS las figuras del capítulo

El tutor especificó reglas de formato concretas que deben aplicarse de manera uniforme a las figuras ya existentes y a las nuevas:

- Orden fijo: **primero la figura (diagrama/imagen/código), después el título "Figura N. [Descripción]", después "Fuente: Elaboración propia"** — nunca al revés, nunca con el título arriba del contenido.
- Un fragmento de código presentado como evidencia (ej. el extracto de `aggregator.rs`, o cualquier fragmento de test) debe tratarse como figura propia con su numeración y fuente, no como bloque de código suelto sin identificar — esto ya se aplica parcialmente en la versión actual, verificar que sea 100% consistente en todas las apariciones.
- Los diagramas complejos (la nueva Figura de Componentes Internos y la nueva Figura de Síntesis de Integración, en particular) pueden y deben ser más grandes/detallados que las figuras de resultados de prueba — no forzar todos los diagramas al mismo tamaño o nivel de detalle.
- Después de renumerar (ver siguiente sección), verificar que **cada** mención de "Figura 4.X" dentro del texto corrido coincida exactamente con el número real de la figura referenciada — revisar el capítulo completo, no solo los títulos de figura, buscando también menciones en prosa tipo "como se observa en la Figura 4.X".

---

## Reestructuración de secciones (agregar, no reescribir)

Insertar dos secciones nuevas y renumerar las figuras en consecuencia:

- **4.2.3 Arquitectura de Componentes** (nueva, Prioridad 1) — insertada después de la actual 4.2.2, antes de la actual 4.2.3 "Estructura Física de Directorios de Directorios del Proyecto", que pasa a ser **4.2.4**.
- **4.8 Síntesis de Integración del Sistema** (nueva, Prioridad 2) — insertada al final del capítulo, después de la actual 4.7 (Pruebas y Resultados) y antes de las Notas de Verificación Técnica.

Todas las figuras a partir del punto de cada inserción deben renumerarse consecutivamente sin huecos ni duplicados. Revisar el documento completo al final para confirmar correlatividad estricta (4.1, 4.2, 4.3... sin saltos).

---

## Qué NO hacer

- No reescribir el contenido textual/narrativo ya existente y ya aprobado por el tutor.
- No eliminar ninguna de las 7 pruebas, ni sus partes a)/b)/c) ya existentes.
- No eliminar los apartados "Entradas, Componentes y Salidas" ya existentes junto a cada figura — se mantienen como el texto explicativo que acompaña a cada figura, solo que ahora la figura va primero y el texto después (orden: Figura → título/fuente → explicación de Entradas/Proceso/Salidas).
- No convertir absolutamente todo a Mermaid si eso implica perder información real ya verificada (ej. no tocar los bloques de código Rust/Python reales ni las salidas de consola reales ya insertadas en la versión anterior).
- No renumerar secciones que no sean estrictamente necesarias por las 2 inserciones indicadas arriba.

---

## Formato de entrega esperado

Devolver el Capítulo 4 completo con estas 4 prioridades aplicadas sobre la versión más reciente ya validada (la que ya incluye diagramas Mermaid de arquitectura, pipeline, layout GraphForge UI, fallback de IA, la tabla/matriz de acoplamiento, y las 7 pruebas con código + consola real + incidencias). Mantener el mismo estilo de redacción académica en español.

Al final del archivo, en las Notas de Verificación Técnica, agregar:
- Confirmación de que el Diagrama de Componentes Internos (Prioridad 1) refleja nombres de archivo reales verificados uno por uno contra `src-tauri/src/engine/`, no una reconstrucción aproximada.
- Lista de qué mini-diagramas de prueba (Prioridad 3) pudiste construir con confianza total y cuáles, si los hay, quedaron con algún nodo genérico por no poder verificar el detalle exacto del componente interno.
