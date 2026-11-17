# GUÍA COMPLETA DE INSPECCIÓN Y DEFENSA DE SOFTWARE — SAAC
*Software Architecture Analysis Companion — Guía rápida de respuestas técnicas para el tribunal y tutor*

---

## 1. GENERALIDADES Y ARQUITECTURA DEL SISTEMA

### ❓ ¿Qué es SAAC y qué problema resuelve?
* **Respuesta**: Es una plataforma de escritorio para la inspección estática, cálculo de métricas de arquitectura, detección automática de antipatrones, generación de diagramas C4 y simulación propositiva de cambios. Resuelve la falta de visibilidad del diseño interno en código fuente multilenguaje y elimina la desactualización del diagramado manual.

### ❓ ¿Por qué se utilizó Tauri v2 con Rust en lugar de Electron?
* **Respuesta**: 
  1. **Consumo de Memoria**: RAM $< 50 \text{ MB}$ en reposo ($85 \text{ MB}$ en escaneo) frente a $> 300 \text{ MB}$ de Electron.
  2. **Rendimiento Nativo**: El motor analítico compila a binario nativo en Rust de alto rendimiento sin sobrecarga de V8 Node.js.
  3. **Seguridad**: Proceso backend aislado con permisos estrictos de IPC.

### ❓ ¿Cómo funciona la arquitectura interna en 5 capas del sistema?
* **Respuesta**:
  1. **Capa Backend Core (Rust Engine)**: Orquestación, cálculo de métricas ($Ca, Ce, I, D, MI$), algoritmo Tarjan SCC y caché `sled`.
  2. **Capa Worker Pool (Node.js & Python)**: Subprocesos aislados que leen sintaxis con TS Compiler API y Tree-Sitter.
  3. **Capa IDE UI (React 18 + TypeScript)**: Interfaz de 5 regiones con 9 Zustand Stores para estado reactivo sin re-renders masivos.
  4. **Capa Lienzo C4 & Diagramas (ReactFlow v11 + Dagre)**: Renderizado de grafos con ordenamiento jerárquico a 60 FPS.
  5. **Capa Inteligencia Artificial Contextual (`AiClient`)**: Integración con Ollama (local offline) y Gemini Cloud.

### ❓ ¿Cómo procesa 9 lenguajes distintos de programación sin necesidad de compilar el proyecto del usuario?
* **Respuesta**: Utiliza análisis sintáctico puro (AST - *Abstract Syntax Tree*). Los trabajadores (*workers*) parsean los archivos fuente (.ts, .js, .py, .java, .go, .rs, .cs, .kt, .swift) y extraen declaraciones de paquetes, clases, funciones e importaciones sin ejecutar ni compilar el código.

---

## 2. INTERPRETACIONAL DE MÉTRICAS Y VALORES (¿Qué significa cada número?)

### ❓ ¿Qué es el Fitness Score Global y cómo se interpreta?
* **Respuesta**: Es una métrica sintética (0 a 100) que mide la salud general de la arquitectura del proyecto basada en 5 principios de software limpio:
  * **Score > 80 (Verde / Excelente)**: Código bien modularizado, bajo acoplamiento eferente y sin ciclos.
  * **Score 60 - 79 (Amarillo / Alerta)**: Presenta módulos complejos o acoplamiento moderado.
  * **Score < 60 (Rojo / Crítico)**: Presencia de antipatrones severos, dependencias circulares o *God Modules*.

### ❓ ¿Qué representa el Índice de Mantenibilidad (Maintainability Index - MI)?
* **Respuesta**: Mide la facilidad de modificar y mantener un módulo (rango 0 a 100), calculado mediante la fórmula empírica de Coleman:
  $$\text{MI} = \max\left(0, \frac{171 - 5.2 \ln(\text{Volumen Halstead}) - 0.23 (\text{CC}) - 16.2 \ln(\text{LOC})}{171} \times 100\right)$$
  * **$MI \ge 80$**: Alta mantenibilidad (Código limpio).
  * **$MI < 60$**: Código complejo, difícil de mantener y propenso a errores.

### ❓ ¿Qué significa Acoplamiento Aferente ($Ca$) y Acoplamiento Eferente ($Ce$)?
* **Respuesta**:
  * **Acoplamiento Aferente ($Ca$)**: Número de módulos externos que **dependen de** este módulo (Mide *Responsabilidad*).
  * **Acoplamiento Eferente ($Ce$)**: Número de módulos de los cuales **este módulo depende/importa** (Mide *Dependencia*).

### ❓ ¿Qué es la Instabilidad ($I$), la Abstractness ($A$) y la Distancia ($D$)?
* **Respuesta**:
  * **Instabilidad ($I = \frac{Ce}{Ca + Ce}$)**: Rango 0 a 1. $I = 0$ significa módulo totalmente rígido/estable (difícil de cambiar); $I = 1$ significa módulo totalmente inestable/flexible.
  * **Abstractness ($A$)**: Proporción de clases e interfaces abstractas respecto al total de clases.
  * **Distancia a la Secuencia Principal ($D = |A + I - 1|$)**: Mide qué tan desviado está el módulo del equilibrio ideal entre abstracción y estabilidad:
    * **$D \approx 0$**: Diseño balanceado ideal.
    * **Zona de Dolor ($A=0, I=0$)**: Módulo rígido, concreto y altamente dependido (difícil de refactorizar).
    * **Zona de Inutilidad ($A=1, I=1$)**: Módulo abstracto sin ninguna dependencia que lo utilice.

### ❓ ¿Qué es la Complejidad Ciclomática Máxima (CC)?
* **Respuesta**: Es el número de caminos linealmente independientes a través del código de un módulo (estructuras `if`, `for`, `while`, `switch`). Valores superiores a 15 indican métodos demasiado complejos que deben ser divididos.

---

## 3. DIAGNÓSTICO DE ANTIPATRONES Y ALGORITMOS NATIVOS

### ❓ ¿Cómo detecta el sistema las Dependencias Circulares?
* **Respuesta**: Utiliza el algoritmo de **Componentes Fuertemente Conectados de Tarjan (Tarjan SCC)** sobre el grafo dirigido en `aggregator.rs`. Se ejecuta en tiempo lineal $O(V + E)$ e identifica cualquier conjunto de módulos donde exista un camino cerrado (ej. Módulo A $\rightarrow$ Módulo B $\rightarrow$ Módulo A).

### ❓ ¿Qué es el Antipatrón God Module / Concentrador?
* **Respuesta**: Es un módulo que supera las 200 líneas de código ($LOC > 200$) y posee un acoplamiento eferente elevado ($Ce > 10$), indicando que ha asumido demasiadas responsabilidades y viola el Principio de Responsabilidad Única (SRP).

### ❓ ¿Qué es una Violación de Capa (Layer Violation)?
* **Respuesta**: Se detecta cuando un componente de la capa de presentación o interfaz importa directamente componentes de la capa de persistencia/base de datos, saltándose la capa intermedia de lógica de negocio o dominio.

---

## 4. GUÍA COMPLETA DE VISTAS Y PANTALLAS PRINCIPALES

### 🖥️ A. Pestaña "Dashboard" (Panel Principal)
* **¿Qué contiene esta pantalla?**:
  1. **Hero Header / Resumen del Proyecto**: Muestra el nombre del proyecto analizado, la ruta del directorio en disco, el número total de módulos y dependencias.
  2. **Card de Salud Global & Fitness Score**: Tarjeta principal que destaca la nota global (0-100), el número de antipatrones detectados y el estado de mantenibilidad.
  3. **Gráficos de Distribución**: Muestra la composición del proyecto por lenguaje de programación (TypeScript, Python, Java, etc.) y la distribución de mantenibilidad.
  4. **Tabla de Resumen de Módulos Críticos**: Lista el TOP 5 de los módulos que requieren atención inmediata por baja mantenibilidad o alta complejidad.
  5. **Mini-Grafo de Dependencias**: Vista previa condensada de la red de relaciones.

### 📊 B. Pestaña "Métricas" (`MetricsPanel.tsx`)
* **¿Qué significa esta tabla?**: Es el cuadro de mando cuantitativo completo del software.
  * **Columnas de la Tabla**:
    * `Módulo`: Identificador o ruta del archivo analizado.
    * `Lenguaje`: Lenguaje de programación detectado.
    * `LOC`: Líneas de código reales (*Lines of Code*).
    * `Ca`: Acoplamiento aferente (cuántos módulos lo usan).
    * `Ce`: Acoplamiento eferente (cuántos módulos requiere).
    * `Instabilidad (I)`: Ratio de rigidez/flexibilidad (0 a 1).
    * `Mantenibilidad (MI)`: Índice de mantenibilidad (0 a 100).
    * `Complejidad (CC Máx)`: Máxima complejidad ciclomática de sus funciones.
  * **Filtros**: Permite buscar módulos por texto o filtrar únicamente los módulos con alerta de mantenibilidad ($MI < 60$).
  * **Botonera de Exportación**: Permite descargar la tabla de métricas en formato JSON o CSV.

### ⚠️ C. Pestaña "Antipatrones" (`AntipatternsPanel.tsx`)
* **¿Qué muestra esta pantalla?**: Lista todas las anomalías arquitectónicas detectadas en el código fuente.
  * **Tarjetas de Antipatrón**: Cada tarjeta especifica el nombre del antipatrón (*Circular Dependency*, *God Module*, *Layer Violation*), la **severidad** (Alta en rojo, Media en amarillo, Baja en azul), una **descripción clara del problema** y la **Ruta del Ciclo** (secuencia de importaciones que causan la falla).

### 📋 D. Pestaña "ADRs - Registros de Decisiones Arquitectónicas" (`AdrsPanel.tsx`)
* **¿Qué es un ADR y qué muestra esta vista?**: Es el registro formal de las decisiones de diseño adoptadas en el proyecto (ej. *"Migración de Electron a Tauri v2"*).
  * **Información de la Tabla/Tarjetas**: Título de la decisión, estado (*Propuesto, Aprobado, Rechazado, Deprecado*), fecha de creación, autor, contexto y justificación técnica.
  * **Modal de Creación (`AdrFormModal`)**: Permite registrar nuevos ADRs y vincularlos a los módulos afectados del proyecto.

### 📋 F. Pestaña "Catálogo de Módulos" (`ModulesCatalogView.tsx`)
* **¿Qué es esta pantalla?**: Un directorio interactivo que organiza todos los módulos del software en vista de cuadrícula o lista detallada. Permite filtrar por lenguaje, tipo de módulo y ordenar por LOC, mantenibilidad (MI) o acoplamiento eferente ($Ce$). Cada módulo incluye un distintivo de color dinámico por grupo y botones para saltar al lienzo C4 o al entorno de código IDE.

### 💻 G. Pestaña "Visualizador de Código IDE" (`CodeIdeView.tsx`)
* **¿Qué es esta pantalla?**: Un entorno de inspección de código integrado estilo VS Code / JetBrains con visor multi-pestaña, números de línea, resaltado de sintaxis por AST, copia rápida al portapapeles y un panel lateral de estructura (*Outline*) que extrae clases, métodos, funciones exportadas e importaciones con su respectiva complejidad ciclomática ($CC$).

### 🎨 H. Diferenciación de Color por Grupo de Módulos (`getModuleGroupColor`)
* **¿Cómo funciona la diferenciación de color en los diagramas?**: Utiliza un algoritmo de hashing determinista sobre el nombre/identificador del módulo para asignar un color distintivo y armonioso a todos los elementos del mismo grupo/paquete. Esto permite asociar visualmente de un vistazo a qué subsistema pertenece cada nodo tanto en el lienzo C4 como en el catálogo y el visor de código.

---

## 5. GUÍA EXHAUSTIVA DE LOS 16 DIAGRAMAS DEL SISTEMA

### 🏛️ A. Diagramas C4 Core (Jerarquía C4)
1. **C4 Nivel 1 — Contexto**: Muestra la visión macro del sistema SAAC frente a Actores (Desarrollador/Arquitecto) y Sistemas Externos (Ollama, Gemini, GitHub).
2. **C4 Nivel 2 — Contenedores**: Muestra las unidades desplegables ejecutable nativo Tauri, motor Rust Engine, pool de workers AST y base de datos local `sled`.
3. **C4 Nivel 3 — Componentes**: Muestra los módulos internos de la aplicación (`engine`, `c4viewer`, `design`, `ai`, `metrics`).
4. **C4 Nivel 4 — Código (UML)**: Muestra el detalle fino a nivel de clases, atributos, métodos y firmas de código de un archivo seleccionado.

### 🌐 B. Diagramas SuplementariosEspecializados
5. **Módulos Circulares (`circular`)**: Filtra el grafo para mostrar exclusivamente los módulos atrapados en dependencias circulares.
6. **Diagrama de Paquetes (`package`)**: Agrupa los módulos por carpetas/paquetes para mostrar el acoplamiento a nivel de estructura física.
7. **Árbol de Herencia (`inheritance`)**: Muestra las relaciones de extensión e implementación (`extends` / `implements`) entre clases.
8. **Diagrama Entidad-Relación (`er`)**: Visualiza las clases de entidad de datos, sus atributos y relaciones de clave primaria/foránea.
9. **Grafo de Llamadas (`callgraph`)**: Representa la red de invocaciones entre funciones y métodos del sistema.
10. **Diagrama de Secuencia (`sequence`)**: Flujo cronológico paso a paso del intercambio de mensajes entre componentes.
11. **Diagrama Dinámico C4 (`dynamic`)**: Muestra la interacción entre componentes para un caso de uso o flujo específico.
12. **Diagrama de Flujo de Datos (`dfd`)**: Modela cómo viaja la información entre procesos, entidades externas y almacenes de datos.
13. **Mapa de Calor de Acoplamiento (`coupling-heatmap`)**: Matriz de adyacencia módulo $\times$ módulo; las celdas en rojo señalan acoplamiento eferente directo.
14. **Diagrama de Despliegue (`deployment`)**: Muestra la infraestructura física/virtual donde residen los componentes (Cliente Desktop, Servidor Ollama, API Cloud).
15. **Árbol de Directorios / Grafo Horizontal (`filetree`)**: Grafo interactivo horizontal expandible con iconos y etiquetas por lenguaje.
16. **Mapa de Carpetas / Treemap (`treemap`)**: Rectángulos proporcionales a las Líneas de Código (LOC) coloreados según el Índice de Mantenibilidad.
17. **Mapa de Contribuciones / Ownership (`ownership`)**: Asigna autoría por módulo y alerta en amarillo sobre módulos con riesgo de *Bus Factor* ($LOC > 150$ y $Ce > 8$).
18. **Paisaje del Sistema / Landscape (`landscape`)**: Vista panorámica del conjunto de sistemas de la organización.
19. **Línea de Tiempo / Timeline (`timeline`)**: Gráfico histórico de tendencia que muestra cómo ha evolucionado el Fitness Score del proyecto a través de sucesivas ejecuciones.
20. **Grafo de Fuerza / Nodos Proporcionales (`force-graph`)**: Esferas donde el **tamaño** es proporcional al número de conexiones ($Ca+Ce$) y el **color** refleja el estado de salud ($MI$).

---

## 6. GUÍA DE ELEMENTOS DE NAVEGACIÓN Y ESTRUCTURA DE LA INTERFAZ (IDE)

### ⬆️ Barra Superior (`TopBar.tsx`)
* **Abrir Proyecto**: Abre el selector del sistema operativo para elegir la carpeta del código fuente.
* **Analizar / Reanalizar**: Dispara el análisis sintáctico AST del motor nativo en Rust.
* **🧪 Demo (Modo Demo)**: Carga datos sintéticos de prueba para realizar demostraciones o capturas sin necesidad de analizar un proyecto real en ese instante.
* **Selector de Diagramas**: Menú desplegable para cambiar instantáneamente entre el Modelo C4 Core y los 16 Diagramas Suplementarios.
* **Perspectivas (Seguridad / Autoría)**: Alterna capas visuales para resaltar vulnerabilidades o propiedad de código.
* **Botones de Paneles (Izquierdo, Inferior, Derecho)**: Ocultan o muestran los paneles laterales y el panel inferior.
* **Alternador de Tema (Sol/Luna)**: Cambia en tiempo real entre el **Modo Oscuro** (Dark Mode) y **Modo Claro** (Light Mode) con paleta armonizada HSL.

### ⬅️ Barra de Actividad Lateral Izquierda (`Leftbar.tsx` Activity Bar - 46px)
* **Iconos siempre visibles**:
  * 📁 **Explorador**: Abre el árbol de directorios y módulos.
  * 🧭 **Jerarquía C4**: Navegación rápida por Niveles C4.
  * 🔍 **Buscar**: Búsqueda e inspección rápida de módulos.
  * 📊 **Dashboard**: Acceso al panel principal.
  * 📈 **Métricas**: Abre la tabla de métricas.
  * ⚠️ **Antipatrones**: Abre la pantalla de antipatrones.
  * 📄 **ADRs**: Abre el registro de decisiones.
  * ✏️ **Diseño**: Abre el lienzo interactivo propositivo.
  * ⚙️ **Configuración IA**: Abre el modal de configuración de proveedores LLM.

### ⬅️ Panel Explorador Izquierdo (`Leftbar.tsx` Explorer Panel - 218px)
* **Pestaña Explorador**: Árbol jerárquico del código fuente con badges de mantenibilidad coloreados por archivo.
* **Pestaña Jerarquía C4**: Botones de acceso directo a Contexto N1, Contenedores N2 y Componentes N3.
* **Pestaña Buscar**: Filtro de búsqueda por texto en tiempo real sobre los nombres e IDs de los módulos.

### ➡️ Inspector Derecho (`Rightbar.tsx` - 275px)
* **Pestaña Inspector**:
  * **Sin Selección**: Muestra la tarjeta del **Fitness Score Global (0-100)** y resumen del proyecto.
  * **Con Selección (Al hacer clic en cualquier nodo o diagrama)**: Despliega las propiedades completas del módulo o nodo seleccionado:
    * *Nombre e ID del archivo*.
    * *Lenguaje y Tipo*.
    * *Líneas de Código (LOC)*.
    * *Métricas de Mantenibilidad (MI), Complejidad Ciclomática (CC), Aferente (Ca), Eferente (Ce)*.
    * *Lista de Módulos que lo importan (Inbound) y Módulos que importa (Outbound)*.
    * *Lista de Clases, Funciones y Métodos internos*.
* **Pestaña Asistente IA (`AiChatPanel.tsx`)**: Chat interactivo que permite realizar consultas en lenguaje natural a la IA sobre la arquitectura del proyecto.

### ⬇️ Panel Inferior (`Downbar.tsx` - 166px)
* **Salida (Output)**: Registro detallado de logs emitidos por el motor ejecutable de Rust durante el escaneo.
* **Problemas (Problems)**: Listado de alertas, violaciones de reglas o errores detectados.
* **Historial (History)**: Registro cronológico de las corridas de análisis anteriores.
* **Consola (Console)**: Consola de comandos CLI integrada.

### 🟢 Barra de Estado Inferior (`StatusBar.tsx` - 23px)
* **Información que muestra**:
  * Estado del motor (*Listo*, *Analizando...*).
  * Duración de la última ejecución en milisegundos (ej. *438ms*).
  * Estado del proveedor de IA y puerto local (`localhost:11434`).
  * Indicador del tema visual activo (*Modo Claro / Modo Oscuro*).

---

## 7. MÓDULO DE DISEÑO INTERACTIVO CANVAS (PROPOSITIVO Y COMPARATIVO)

### ❓ ¿Para qué sirve el Módulo de Diseño Interactivo (`DesignWorkspace`)?
* **Respuesta**: Es un entorno visual tipo canvas donde el arquitecto puede planificar refactorizaciones futuras (agregar/quitar módulos, cambiar conexiones, crear contenedores) arrastrando componentes desde la paleta sin tocar el código fuente real.

### ❓ ¿Con qué se compara el diagrama diseñado en el canvas?
* **Respuesta**: Se compara mediante la función IPC en Rust `compare_proposed_architecture` contra el **AMG (Estado Real Analizado en la corrida estática actual)**.

### ❓ ¿Qué información entrega el Reporte de Diferencias (`ComparisonReport`)?
* **Respuesta**: 
  1. **Nodos Añadidos / Eliminados**: Módulos o servicios propuestos nuevos o eliminados.
  2. **Aristas Añadidas / Eliminadas**: Conexiones nuevas o suprimidas.
  3. **Propiedades Modificadas**: Cambios de tipo, nombre o responsabilidad.
  4. **Impacto Proyectado**: Variación estimada en el Fitness Score (ej. $+4.2$ puntos tras eliminar un ciclo).

---

## 8. ASISTENTE DE INTELIGENCIA ARTIFICIAL CONTEXTUAL

### ❓ ¿Cómo funciona el Asistente de IA y cómo garantiza el 100% de Privacidad?
* **Respuesta**: El módulo `AiClient` inyecta únicamente un resumen estructurado del Grafo AMG (métricas, antipatrones y lista de módulos) en la consulta, **sin enviar el código fuente completo**.
* **Privacidad**: Se conecta de forma predeterminada a servidores de modelos de lenguaje locales offline (**Ollama** en `localhost:11434` ejecutando modelos como *Llama 3 8B* o *Qwen 2.5 Coder*), garantizando que los datos nunca salgan de la máquina del usuario.
* **Mock Fallback**: Si el servidor local está apagado, el sistema activa automáticamente un modo *Mock Fallback* en 5 ms para permitir la demostración sin caídas.

---

## 9. VALORACIÓN ECONÓMICA Y METODOLOGÍA DE DESARROLLO

### ❓ ¿Cuál es el costo total estimado de desarrollo del software SAAC?
* **Respuesta**: **20,880.00 Bolivianos (~$2,997.31 USD)**.
  * **Esfuerzo de Ingeniería**: 400 horas-hombre a 50.00 Bs/hr = $20,000.00 \text{ Bs.}$
  * **Depreciación de Cómputo**: $300.00 \text{ Bs.}$
  * **Consumo Eléctrico**: $80.00 \text{ Bs.}$
  * **Servicios e Internet**: $500.00 \text{ Bs.}$
  * **Licencias de Software**: **$0.00 Bs.** (100% desarrollado sobre frameworks y herramientas Open Source).

### ❓ ¿Qué metodología de desarrollo se aplicó en el proyecto?
* **Respuesta**: Se aplicó la metodología propia **DMIR (Desarrollo Modular Iterativo con Retroalimentación)** organizada en 4 fases (*Definir, Construir, Validar, Retroalimentar*) combinada con el método **Kanban en GitHub Projects** utilizando un estricto **límite de WIP = 2 tareas simultáneas** en desarrollo.
