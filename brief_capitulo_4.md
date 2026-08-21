# Brief técnico v3 — Correcciones del Revisor sobre el Capítulo 4 (Ingeniería del Proyecto)

## Contexto para la IA que ejecuta esta tarea

Estás trabajando sobre el repositorio real de **SAAC v2.0**. Tienes acceso de lectura al código fuente completo (`src-tauri/`, `src/`, `workers/`, `shared/types.ts`, `tests/`), y en lo posible acceso a una terminal para **ejecutar la suite de pruebas real** y capturar su salida.

El Capítulo 4 de la tesis ya fue revisado por el ingeniero guía/tutor del proyecto en una sesión de retroalimentación oral. Su observación central, repetida de varias formas durante toda la sesión, fue:

> **"El texto está bien, pero no es suficiente. Necesitamos que nos entre por los ojos."**

Es decir: el capítulo ya describe correctamente QUÉ se implementó, pero le falta mostrar CÓMO se ve, CÓMO se conecta cada pieza (entradas/salidas), y QUÉ RESULTADO REAL produjo cada prueba — incluyendo errores encontrados y cómo se corrigieron, no solo un resultado final "PASS" limpio.

**Regla de oro (se mantiene de briefs anteriores): no inventar nada que no puedas verificar en el repo.** Si no puedes ejecutar las pruebas o generar una captura real, dilo explícitamente en vez de simular un resultado.

---

## Los 6 puntos de corrección exactos del revisor

### 1. Cada figura debe anclarse al texto explicando entradas y salidas del componente

El revisor dijo explícitamente: *"yo no entiendo dónde entra en tu sistema... sería identificar en qué parte, cuál es ese componente... ¿cuáles son las entradas y cuáles son tus salidas? Básicamente eso es lo que necesitamos."*

**Qué hacer:** Para cada diagrama o figura ya insertada en el capítulo (arquitectura general, pipeline de análisis, mecanismo de fallback de IA, layout GraphForge UI, etc.), agregar **antes o después de la figura** un párrafo corto (3-5 líneas) que explique en lenguaje llano:
- Qué componente específico representa esa parte del diagrama.
- Qué entra a ese componente (qué datos, de dónde vienen).
- Qué produce como salida y hacia dónde va.

Ejemplo de la forma esperada (no copiar literal, adaptar a cada figura real): *"Como se observa en la Figura 4.2, el Aggregator recibe como entrada el conjunto de ASTs parseados por los workers (estructuras JSON con clases, métodos e invocaciones) y produce como salida el AMG consolidado, incluyendo las métricas de acoplamiento (Ca, Ce, I, D) y la lista de antipatrones detectados, que se entrega de vuelta al frontend vía IPC."*

Aplicar esto a **cada figura existente del capítulo**, no solo a una. Revisar el archivo actual del capítulo y hacer un inventario de todas las figuras/diagramas ya insertados antes de empezar.

### 2. Formato correcto de figuras (aplica a TODAS las figuras del capítulo)

El revisor especificó reglas de formato concretas:
- El título de la figura y la fuente ("Fuente: Elaboración propia") van **debajo** de la imagen/diagrama, nunca arriba.
- El texto de "Figura N. [Título]" debe ir en una fuente más pequeña que el cuerpo del documento (si el cuerpo usa 12pt, la figura usa 11pt), para diferenciarse visualmente del texto normal.
- Las figuras deben ir centradas en la página.
- Un contenido textual (como un extracto de payload JSON, un fragmento de consola, o una salida de comandos) que se presenta como evidencia visual **debe tratarse como una figura/captura propia, con su numeración y su "Fuente: Elaboración propia"** — no como un bloque de código suelto en medio del párrafo sin identificar.
- Diagramas complejos que no se leerían bien en un tamaño pequeño (ej. el diagrama de arquitectura de 5 capas) deben poder ocupar el ancho completo de la página si es necesario — no forzarlos a un tamaño reducido solo por consistencia visual.

**Qué hacer:** Revisar cada figura, tabla y bloque de código/JSON ya insertado en el capítulo y aplicar este formato de forma consistente. Cuando generes el archivo Markdown, indicar estas reglas de formato como comentario o nota, ya que Markdown no controla tamaño de fuente directamente — el autor las aplicará al pasar el documento a Word. Aun así, ordenar el markdown de forma que el título/fuente quede siempre inmediatamente después del bloque de imagen/diagrama/código, nunca antes.

### 3. Falta una figura dedicada a la estructura de directorios del proyecto

El revisor preguntó dos veces: *"tu estructura de directorios, ¿dónde la tienes?"* y aclaró que debe estar **como una figura propia y aparte**, no solo mencionada de pasada dentro del texto.

**Qué hacer:** Generar el árbol de directorios real del proyecto (usando el comando `tree` o equivalente sobre el repo, limitando la profundidad a 2-3 niveles para que sea legible, excluyendo `node_modules`, `target`, `.git` y artefactos de build) y presentarlo como una figura de tipo captura/bloque de código, ubicada en la sección 4.2.2 (Arquitectura General del Sistema) o al inicio de 4.3 (Desarrollo del Core), inmediatamente después o antes del diagrama de arquitectura en capas — de forma que el lector pueda relacionar cada carpeta con la capa arquitectónica correspondiente. Etiquetarla como Figura propia con su numeración y fuente.

### 4. Las pruebas necesitan evidencia real de construcción, ejecución y errores corregidos — no solo una tabla de resultados

Esta es la observación más extensa y específica del revisor: *"no [es] más de escribir cómo está la prueba porque las pruebas yo igual mismo las construí, entonces sería como... así está construido y esto salió exactamente, estos son los errores y estas son sus correcciones."*

**Qué hacer, para cada una de las 7 suites de prueba ya mencionadas (`test_worker_contract.py`, `test_analyze_project.py`, `test_resolved_imports.py`, `test_antipatterns.py`, `test_c4_diagrams.py`, `test_supplementary_diagrams.py`, `test_ai_integration.py`):**

a) **Cómo está construida**: incluir un fragmento corto (10-20 líneas máx.) del código real de la prueba, mostrando qué se está verificando concretamente (el `assert` o la validación central), no solo el nombre del archivo.

b) **Qué resultado salió al ejecutarla**: ejecutar la suite de pruebas real en el entorno del proyecto (`pytest`, `cargo test`, o el comando que corresponda) y capturar la salida real de consola (texto plano, no inventado). Si no es posible ejecutar las pruebas en este momento, decirlo explícitamente en las notas finales y no inventar una salida de consola.

c) **Si hubo errores y cómo se corrigieron**: revisar si existe historial de commits, changelog, o comentarios en el código que documenten fallos encontrados durante el desarrollo de cada prueba y su corrección posterior (por ejemplo, el caso ya mencionado en el capítulo de la detección de estilo arquitectónico Layered/Hexagonal, que originalmente evaluaba por módulo individual y producía falsos negativos, corregido para evaluar de forma global). Si se identifican más casos similares documentados en el repo (commits con mensajes tipo "fix:", código comentado explicando un bug corregido, etc.), incluirlos como ejemplos concretos de "esto falló, esto se corrigió". Si no se encuentra evidencia de errores/correcciones para alguna prueba específica, no inventar ninguno — dejarlo constar en las notas finales como "sin incidencias documentadas en el historial revisado".

Formato esperado para cada prueba: una breve subsección o bloque con tres partes claras (Construcción → Ejecución → Incidencias), en vez de solo una fila de tabla con "PASS".

### 5. El módulo de IA necesita mostrarse como integración con entrada/proceso/salida explícita

El revisor preguntó: *"cuando dice integración, ¿qué se integra? ¿dónde se integra?... se integra aquí y va a obtener estos datos y va a servir para esto."*

**Qué hacer:** En la sección 4.5 (Integración de Inteligencia Artificial Arquitectónica), antes o junto al diagrama de fallback ya existente, agregar una explicación breve y explícita del ciclo completo de integración:
- **Entrada**: qué recibe el módulo de IA (el AMG serializado + métricas + la consulta en lenguaje natural o comando slash del usuario).
- **Proceso**: qué hace con eso (construye el prompt contextual según el modo — FullAmg, ModuleDetail o AntipatternDetail — y lo envía al proveedor configurado).
- **Salida**: qué produce y a dónde va (una respuesta en Markdown que se renderiza en el `AiChatPanel` vía `MarkdownRenderer`, o en caso de fallo, la respuesta simulada del modo Mock).

Esto puede integrarse como texto que acompañe al diagrama de flujo ya existente (Figura de fallback de IA), no necesariamente como una figura nueva, pero debe quedar explícito y no solo implícito en el diagrama.

### 6. Aplicar el mismo criterio de "entrada/componente/salida" a CUALQUIER otro diagrama del capítulo que no lo tenga

Revisar el capítulo completo (no solo las secciones ya mencionadas) y asegurarse de que **cada** figura, diagrama o captura tenga:
- Un anclaje textual explícito indicando qué representa dentro de la arquitectura general del sistema.
- Una identificación clara de qué componente específico ilustra.
- Una mención de sus entradas y salidas si aplica (esto puede omitirse solo en figuras puramente descriptivas como una tabla de tecnologías, pero debe aplicarse a todo diagrama de flujo, secuencia, o arquitectura).

---

## Qué NO hacer

- No reescribir el capítulo desde cero.
- No eliminar ni reemplazar el contenido narrativo ya existente y aprobado en versiones anteriores (los requisitos RF/RNF, la tabla de selección tecnológica, las secciones 4.3.1 a 4.3.4, 4.6, etc. se mantienen).
- No renumerar secciones existentes.
- No inventar salidas de consola, resultados de pruebas, ni commits/correcciones que no puedas verificar realmente en el repositorio. Si algo no se puede confirmar, se anota como pendiente, tal como se ha hecho en brief anteriores.

---

## Formato de entrega esperado

Devolver el Capítulo 4 completo con estas correcciones aplicadas sobre la versión más reciente ya validada (la que incluye los diagramas Mermaid, el código de `aggregator.rs`, la sección GraphForge UI, el `MarkdownRenderer`, y la tabla de pruebas). Mantener el mismo estilo de redacción académica en español ya usado.

Al final del archivo, en la sección de notas de verificación, agregar:
- Confirmación de si se pudo ejecutar la suite de pruebas real y obtener salida real de consola, o si esto quedó pendiente por falta de acceso al entorno de ejecución.
- Lista de qué pruebas sí tienen un caso de "error encontrado → corrección aplicada" documentado y verificable, y cuáles no tienen incidencias documentadas en el historial revisado.
- Confirmación de que el árbol de directorios presentado corresponde a una ejecución real sobre el repo actual, no a una reconstrucción de memoria.