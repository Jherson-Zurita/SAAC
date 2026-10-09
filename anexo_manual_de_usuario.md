# ANEXO A: MANUAL DE USUARIO Y GUÍA DE OPERACIÓN DEL SISTEMA SAAC

**Sistema de Análisis de Arquitectura de Código (SAAC)**  
*Documentación Técnica y Operativa para el Usuario, Inspección de Software y Defensa Grado*

---

## 1. INTRODUCCIÓN Y REQUISITOS DEL SISTEMA

El **Software Architecture Analysis Companion (SAAC)** es una plataforma de escritorio diseñada para la auditoría estática, extracción automática de diagramas C4 y suplementarios, medición cuantitativa de salud de código (*Fitness Functions*) y simulación propositiva de cambios arquitectónicos sobre proyectos multilenguaje.

### 1.1 Requisitos del Entorno

| Componente | Requisito Mínimo | Requisito Recomendado |
| :--- | :--- | :--- |
| **Sistema Operativo** | Windows 10/11 (64-bit), macOS 12+, Linux | Windows 11 (64-bit) |
| **Procesador (CPU)** | Intel Core i3 / AMD Ryzen 3 (Quad-Core) | Intel Core i7 / AMD Ryzen 7 o superior |
| **Memoria RAM** | 4 GB RAM | 8 GB RAM o superior |
| **Almacenamiento** | 250 MB para la aplicación ejecutable | 1 GB de espacio libre en disco SSD |
| **Dependencias de Entorno** | Runtime nativo WebView2 (incluido en Windows 10/11) | Ollama instalado localmente (Opcional para IA Offline) |

> [!NOTE]
> Gracias a la compilación nativa en **Tauri v2 con Rust**, SAAC opera con un consumo de memoria RAM inferior a $50 \text{ MB}$ en reposo y $85 \text{ MB}$ durante escaneos intensivos, permitiendo ejecutar modelos de lenguaje locales (vía Ollama) sin ralentizar la experiencia de usuario.

---

## 2. PANTALLA DE BIENVENIDA Y CARGA DE PROYECTOS

Al iniciar la aplicación, el usuario es recibido por la pantalla principal de **GraphForge UI**. Desde esta vista se administra la apertura de proyectos reales o la carga interactiva de proyectos demostrativos.

![Pantalla de Bienvenida y Selección de Proyecto en SAAC](file:///C:/Users/Hp/.gemini/antigravity-ide/brain/1fd96d29-dc68-43fc-9f7f-eaddb8be974e/saac_user_manual_welcome_1788520237818.png)

### 2.1 Pasos para Cargar un Proyecto para Análisis

1. Haga clic en el botón principal **"Seleccionar Carpeta de Proyecto"** o presione el acceso directo `Ctrl + O`.
2. Utilice el explorador de archivos nativo para seleccionar la carpeta raíz del repositorio que desea analizar (admite código fuente en TypeScript, JavaScript, Python, Java, Go, Rust, C#, Kotlin y Swift).
3. Haga clic en **"Analizar"** en la barra superior (`TopBar`). El motor estático procesará los archivos AST y generará automáticamente el Modelo de Grafos de Arquitectura (**AMG**).

> [!TIP]
> **Modo Demo (Prueba Rápida)**: Para realizar demostraciones, tomar capturas de pantalla o evaluar la plataforma sin necesidad de analizar un repositorio extenso, haga clic en el botón **"🧪 Cargar Modo Demo"**. Esto cargará de forma instantánea un dataset de prueba completo.

---

## 3. ARQUITECTURA DE LA INTERFAZ DE USUARIO (GRAPHFORGE UI)

La interfaz gráfica de SAAC está dividida en **5 regiones funcionales independientes** diseñadas para maximizar la productividad y minimizar la carga cognitiva del arquitecto o auditor de código:

```
+-----------------------------------------------------------------------------------+
| 1. TOPBAR (Header): Branding, Navegación de Vistas, Menú "Vista" y Selector C4     |
+------------------+------------------------------------------------+---------------+
|                  |                                                |               |
| 2. LEFTBAR       | 3. LIENZO / CANVAS PRINCIPAL                   | 4. RIGHTBAR   |
| (Activity Bar    |    - Diagramas C4 (N1, N2, N3, N4)             | (Inspector)   |
|   + Explorador   |    - Diagramas Suplementarios (16 Vistas)      |   - Métricas  |
|   + Jerarquía)   |    - Editor de Código IDE                      |   - Detalle   |
|                  |    - Lienzo de Diseño Interactivo              |   - IA Panel  |
|                  |                                                |               |
+------------------+------------------------------------------------+---------------+
| 5. DOWNBAR (Footer Panel): Terminal / Consola, Problemas, Output e Historial      |
+-----------------------------------------------------------------------------------+
```

### 3.1 Descripción de las 5 Regiones

1. **TopBar (Barra Superior)**: Contiene los menús principales (`Archivo`, `Vista`, `Analizar`), accesos directos a vistas de la aplicación, el **desplegable unificado de selección de diagramas** y los conmutadores de paneles.
2. **Leftbar (Panel Izquierdo)**: 
   - **Activity Bar (46px)**: Iconos para alternar entre el Explorador de Archivos (`FolderTree`), la Jerarquía C4 & Diagramas (`Compass`) y la Búsqueda Rápida (`Search`).
   - **Explorador / Jerarquía (218px)**: Muestra la estructura de carpetas o el catálogo completo de vistas y niveles C4.
3. **Lienzo / Canvas Principal**: Área interactiva de renderizado construida sobre ReactFlow v11 y Dagre. Permite zoom, pan, arrastre de nodos y navegación por doble clic.
4. **Rightbar (Inspector Lateral)**: Panel con 3 pestañas (`Inspector`, `Métricas`, `Asistente IA`). Muestra la salud, acoplamiento, líneas de código y sugerencias del elemento seleccionado.
5. **Downbar (Panel Inferior Terminal)**: Consola de comandos interactiva `saac>`, listado de antipatrones detectados, salida de logs e historial de ejecuciones.

---

## 4. EXPLORACIÓN DE ARQUITECTURA Y DIAGRAMAS C4

SAAC implementa la especificación **C4 Model** propuesta por Simon Brown, permitiendo navegar la arquitectura del software en 4 niveles de abstracción:

![Visualización del Diagrama C4 Nivel 2 en el Canvas Interactivo de SAAC](file:///C:/Users/Hp/.gemini/antigravity-ide/brain/1fd96d29-dc68-43fc-9f7f-eaddb8be974e/saac_user_manual_c4_view_1788520260049.png)

### 4.1 Niveles de Abstracción C4

* **C4 Nivel 1 — Contexto**: Muestra el sistema SAAC frente a Actores (Desarrolladores/Arquitectos) y Sistemas Externos (Ollama, Gemini, GitHub).
* **C4 Nivel 2 — Contenedores**: Visualiza los módulos ejecutables principales (Nativo Tauri, Motor Rust Engine, Pool de Workers AST y Almacén Sled).
* **C4 Nivel 3 — Componentes**: Desglosa las capas lógicas y módulos de software que integran cada contenedor.
* **C4 Nivel 4 — Código (UML)**: Al hacer doble clic en un componente, extrae en tiempo real las clases, firmas de métodos y atributos en notación UML.

> [!TIP]
> **Navegación Interactiva (Drill-Down)**: Puede navegar hacia niveles de mayor detalle haciendo **doble clic** sobre cualquier nodo en el canvas. Para retroceder de nivel, utilice el selector desplegable en la barra superior o las migas de pan (`Breadcrumbs`).

---

## 5. DIAGRAMAS SUPLEMENTARIOS Y VISUALIZACIONES AVANZADAS

Además de los diagramas C4 estándar, SAAC cuenta con **16 diagramas suplementarios especializados** para auditar aspectos específicos de la arquitectura:

![Visualización del Grafo de Fuerza (Nodos Proporcionales por Mantenibilidad)](file:///C:/Users/Hp/.gemini/antigravity-ide/brain/1fd96d29-dc68-43fc-9f7f-eaddb8be974e/saac_user_manual_force_graph_1788520287416.png)

### 5.1 Catálogo de Diagramas Suplementarios

1. **Grafo de Fuerza (Nodos Proporcionales)**: Renderiza módulos como nodos circulares donde el radio representa las líneas de código (LOC) y el color indica el Índice de Mantenibilidad ($MI \ge 80$ Verde, $60-79$ Amarillo, $<60$ Rojo).
2. **Mapa de Calor de Acoplamiento (Coupling Heatmap)**: Matriz de adyacencia visual para detectar módulos altamente acoplados.
3. **Mapa de Carpetas (Treemap D3)**: Representación jerárquica por bloques de volumen de código.
4. **Diagrama de Paquetes**: Agrupación física por módulos y directorios.
5. **Módulos Circulares**: Filtra de forma inmediata todas las dependencias circulares directas e indirectas ($A \rightarrow B \rightarrow A$).
6. **Árbol de Herencia**: Jerarquía de clases y contratos de herencia.
7. **Diagrama Entidad-Relación (ER)**: Extracción de modelos ORM y entidades persistentes.
8. **Grafo de Llamadas (Call Graph)**: Invocaciones estáticas entre métodos y funciones.
9. **Diagrama de Secuencia**: Flujos temporales inter-componente.
10. **Diagrama Dinámico C4**: Interacciones runtime registradas.
11. **Diagrama de Flujo de Datos (DFD)**: Transformación y flujo de información a través del sistema.
12. **Diagrama de Despliegue**: Mapeo de nodos de infraestructura física.
13. **Árbol de Directorios**: Estructura de carpetas en grafo horizontal.
14. **Mapa de Contribuciones (Ownership)**: Atribución de autoría por archivo.
15. **Paisaje del Sistema (System Landscape)**: Visión empresarial global.
16. **Evolución Arquitectónica (Timeline)**: Registro cronológico de cambios arquitectónicos.

---

## 6. MÓDULO DE DISEÑO ARQUITECTÓNICO INTERACTIVO

SAAC incluye un entorno de diseño tipo canvas que permite a los arquitectos planificar refactorizaciones de software antes de modificar el código fuente real.

![Entorno de Diseño Arquitectónico Interactivo y Comparación Propositiva](file:///C:/Users/Hp/.gemini/antigravity-ide/brain/1fd96d29-dc68-43fc-9f7f-eaddb8be974e/saac_user_manual_design_view_1788520307079.png)

### 6.1 Pasos para Simular una Nueva Arquitectura

1. Seleccione la opción **"Diseño Interactivo"** en la TopBar o presione la pestaña del lápiz en el panel izquierdo.
2. Arrastre componentes arquitectónicos desde la paleta hacia el lienzo.
3. Establezca relaciones y conexiones trazando líneas entre los conectores de los nodos.
4. Haga clic en **"Guardar"** (`Ctrl + S`) para persistir la propuesta en el almacenamiento local.
5. Haga clic en **"Comparar vs AMG"**: El motor de Rust calculará el diferencial de arquitectura (*Diffing*) y proyectará el impacto estimado sobre el **Fitness Score** global.

---

## 7. VISUALIZACIÓN DE CÓDIGO E INTEGRACIÓN CON IA CONTEXTUAL

Para facilitar la auditoría de código, SAAC incorpora un visor de código estilo IDE integrado con un asistente de inteligencia artificial contextual.

![Visor de Código IDE y Asistente de IA Contextual (Ollama / Gemini)](file:///C:/Users/Hp/.gemini/antigravity-ide/brain/1fd96d29-dc68-43fc-9f7f-eaddb8be974e/saac_user_manual_code_ai_1788520326099.png)

### 7.1 Operación del Asistente de IA

* **Apertura del Panel IA**: Haga clic en la pestaña **"Asistente IA"** en la barra lateral derecha (`Rightbar`).
* **Consultas Contextuales**: Puede hacer preguntas directas como: *"¿Cómo puedo resolver el acoplamiento circular en este módulo?"* o *"Explícame la métrica de instabilidad de este archivo"*.
* **Soporte Offline / Online**: Desde la ventana de configuración (`⚙️`), elija entre el proveedor local **Ollama** (offline y privado) o la API en la nube **Google Gemini**.

---

## 8. CONSOLA DE COMANDOS Y PANEL INFERIOR (DOWNBAR)

En la parte inferior de la pantalla se encuentra el panel interactivo **Downbar**, el cual provee acceso directo a la consola de comandos de la aplicación:

### 8.1 Comandos Disponibles en la Consola `saac>`

| Comando | Descripción | Ejemplo de Uso |
| :--- | :--- | :--- |
| `help` | Muestra la lista de comandos disponibles en la consola. | `saac> help` |
| `analyze [path]` | Inicia el escaneo sintáctico AST sobre la ruta indicada. | `saac> analyze d:/proyectos/mi-app` |
| `metrics` | Despliega las métricas cuantitativas consolidadas del proyecto. | `saac> metrics` |
| `clear` | Limpia los registros visibles de la consola. | `saac> clear` |
| `summary` | Muestra el reporte diagnóstico resumido del sistema. | `saac> summary` |

---

## 9. GUÍA DE RESOLUCIÓN DE PROBLEMAS FRECUENTES (TROUBLESHOOTING)

| Síntoma | Posible Causa | Solución Sugerida |
| :--- | :--- | :--- |
| **No se detectan archivos en el proyecto** | La carpeta seleccionada no contiene extensiones compatibles o está vacía. | Verifique que la carpeta posea archivos con extensiones `.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.cs`, `.kt` o `.swift`. |
| **El Asistente IA no responde en modo local** | El servicio de Ollama no está ejecutándose en segundo plano. | Inicie Ollama ejecutando `ollama serve` en su terminal o cambie a Google Gemini en la configuración de IA (`⚙️`). |
| **Diagrama C4 sin conexiones** | El código fuente utiliza invocaciones dinámicas implícitas sin importaciones directas. | Utilice el diagrama suplementario **Grafo de Fuerza** o **Call Graph** para visualizar el mapa estático de funciones. |

---
*Manual de Usuario y Guía de Operación — SAAC*
