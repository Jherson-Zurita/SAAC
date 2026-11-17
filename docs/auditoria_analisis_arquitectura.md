# Auditoría del análisis arquitectónico de SAAC

**Fecha:** 9 de octubre de 2026
**Alcance:** motor de métricas (workers Python y Node), agregador y reglas (Rust), CLI de CI y módulo de diseño.
**Pregunta:** ¿SAAC aporta algo real al análisis de arquitectura? ¿Las métricas que calcula son confiables, están desgastadas o sobreestimadas? ¿Qué le falta para marcar la diferencia?

---

## 1. Resumen ejecutivo

SAAC **sí aporta**, pero su valor está en la parte **estructural**, no en la numérica:

- **Aporta:** reconstruye el grafo de dependencias real en 9 lenguajes, detecta ciclos de forma correcta, genera C4 automáticamente desde el código y, en una sola aplicación local, une documentación (C4, ADRs), historial y diseño de arquitecturas propuestas.
- **Resta credibilidad:** varias métricas numéricas miden otra cosa de lo que dicen, están mal aplicadas al lenguaje o tienen errores de implementación. Como el Fitness Score, los colores del explorador y el informe PDF se construyen sobre ellas, el usuario recibe conclusiones que no se sostienen.
- **Falta lo diferenciador:** no usa la historia de git (puntos calientes, acoplamiento por cambio), no compara el código contra la arquitectura que el usuario declara como intencionada y la CLI de CI no analiza nada.

Hallazgos más graves, en orden:

| # | Hallazgo | Gravedad |
|---|----------|----------|
| H1 | El índice de mantenibilidad (MI) depende casi solo del tamaño del archivo (correlación −0,998 con ln(LOC)). | Alta |
| H2 | La CLI de CI (`cli/saac-cli.js`) es un stub: siempre devuelve Fitness 100, 0 violaciones y código de salida 0. | Alta |
| H3 | Imports TS/JS a archivos con nombre repetido (`index`, `utils`, `main`…) se descartan del Ca/Ce aunque la ruta exacta es conocida. | Alta |
| H4 | Los re-exports de barrels (`export * from './X'`) no se registran como dependencias; 15 vistas aparecen como "nadie las usa". | Media |
| H5 | En TypeScript cada `interface` cuenta como clase abstracta: la abstracción (A) y la distancia (D) pierden sentido. | Media |
| H6 | `moduleCohesion` no mide cohesión; vale 1 en 86 de 91 módulos. | Media |
| H7 | 4 de 7 tipos de antipatrón están declarados pero no tienen detector. | Media |
| H8 | El Fitness Score queda determinado casi solo por la regla de MI en proyectos React/TS. | Media |
| H9 | La detección de estilo y de capas se basa en nombres de carpeta; en el propio repo devuelve "desconocido" con confianza 0. | Baja |

---

## 2. Metodología

1. Lectura del código del motor:
   - `workers/python/metrics/complexity.py`, `cohesion.py` y los parsers por lenguaje en `workers/python/parsers/`.
   - `workers/node/src/parsers/typescript.ts` e `import-resolver.ts`.
   - `src-tauri/src/engine/aggregator.rs`, `rules.rs`, `amg.rs`, `git_info.rs` y `design/comparison.rs`.
   - `cli/saac-cli.js`.
2. Análisis estadístico del AMG guardado del **propio repositorio SAAC**: `.saac/runs/18cf5f2771cb7890-7b08.json`, generado el 26-08-2026. Contiene 91 módulos (89 TypeScript, 2 JavaScript), 208 dependencias y 14.291 LOC.
3. Contraste con la literatura original de cada métrica (sección 9).

**Limitación:** la muestra es un único proyecto TS/React. Los hallazgos de fórmula (H1, H6, H8) aplican a todos los lenguajes porque el código es el mismo en todos los parsers. Los de TS (H3, H4, H5) se verificaron solo en TS. El AMG es anterior a cambios recientes de la interfaz, pero las fórmulas auditadas no han cambiado.

---

## 3. Lo que SAAC hace bien

### 3.1 Parsing y complejidad por lenguaje
- Usa tree-sitter con configuraciones de complejidad **verificadas contra el AST real** de cada lenguaje (`ComplexityLanguageConfig` en `complexity.py`). Distingue `case` de `default` en Java/C#, `when` con condición en Kotlin, `guard` en Swift, etc.
- Calcula complejidad ciclomática y **complejidad cognitiva** (estilo SonarSource, con penalización por anidamiento). La cognitiva es hoy la métrica de complejidad con mejor aceptación práctica.

### 3.2 Resolución de imports específica por lenguaje
- Java: paquetes completos contra raíces de fuentes (`pom.xml`, `build.gradle`).
- Go: rutas de paquete contra `go.mod`, con semántica real de "importar el paquete = todos sus archivos".
- Rust: `use crate::…` contra los crates detectados.
- Python: paquetes y `__init__`.

Pocas herramientas gratuitas resuelven dependencias con esta precisión en más de un lenguaje.

### 3.3 Ciclos
- SCC con Tarjan sobre el grafo **ya resuelto** (`aggregator.rs:1205`), con sugerencia de punto de corte. Es correcto y es la detección arquitectónica más confiable del sistema.

### 3.4 La combinación de funciones
Recuperar la arquitectura, documentarla (C4, ADRs), diseñar una arquitectura objetivo y compararla con la real, todo en una app local:

| Herramienta | Qué cubre | Qué no cubre |
|---|---|---|
| SonarQube | Calidad de código | Arquitectura, C4 |
| Structurizr | C4 como código | Lo dibuja el usuario; no lo recupera del código |
| Sonargraph / Lattix / Structure101 | Conformidad arquitectónica, DSM | Comerciales; sin C4 automático |
| CodeScene | Análisis de comportamiento con git | Comercial; sin C4 |
| ArchUnit / dependency-cruiser | Reglas de dependencias en CI | Sin visualización ni diseño |

SAAC es la única de esta lista que intenta cubrir todo el ciclo. Ese es su nicho.

---

## 4. Hallazgos sobre las métricas

### H1. El índice de mantenibilidad mide tamaño, no mantenibilidad

**Fórmula original** (Coleman, Oman et al., 1994):

```
MI = 171 − 5.2·ln(V) − 0.23·G − 16.2·ln(LOC)
```

donde `V` es el **volumen de Halstead** (operadores y operandos) y `G` la complejidad ciclomática.

**Fórmula implementada**, idéntica en los 8 parsers:

```
MI = 171 − 5.2·ln(LLOC) − 0.23·CC_promedio − 16.2·ln(LOC)    (normalizado a 0–100)
```

Ubicaciones:

| Archivo | Línea |
|---|---|
| `workers/node/src/parsers/typescript.ts` | 873 |
| `workers/python/parsers/python.py` | 853 |
| `workers/python/parsers/java.py` | 663 |
| `workers/python/parsers/kotlin.py` | 1030 |
| `workers/python/parsers/csharp.py` | 885 |
| `workers/python/parsers/swift.py` | 728 |
| `workers/python/parsers/go.py` | 749 |
| `workers/python/parsers/rust.py` | 708 |

El propio comentario de `typescript.ts:869-870` reconoce la simplificación.

**Problemas:**
1. Se sustituye el volumen de Halstead por LLOC. Como LLOC ≈ LOC, dos de los tres términos miden lo mismo: el tamaño.
2. Se usa el CC **promedio** del archivo con coeficiente 0,23, así que la complejidad casi no influye.
3. Se calcula por **archivo**. Visual Studio, por ejemplo, lo calcula por método y luego agrega.

**Evidencia en datos reales (91 módulos):**

| Medida | Valor |
|---|---|
| Correlación de Pearson MI ~ ln(LOC) | **−0,998** |
| Correlación de Spearman MI ~ LOC | −0,993 |
| Correlación MI ~ CC promedio | −0,612 (solo porque los archivos grandes suelen ser más complejos) |
| Aporte del término CC al MI (escala 0–100) | mediana 0,67 puntos; máximo 5,25 |

Caso concreto:

| Archivo | LOC | CC máx. | MI |
|---|---|---|---|
| `shared/types.ts` (solo tipos) | 612 | 1 | 20,05 |
| `Leftbar.tsx` (una función de CC 39) | 419 | 39 | 19,50 |
| `Rightbar.tsx` | 409 | 39 | 19,77 |

Para el MI, un archivo de declaraciones sin lógica es igual de "inmantenible" que un componente con 39 caminos de ejecución.

**Umbrales mal calibrados:**
- La regla de fitness exige `MI promedio ≥ 60` y el explorador pinta verde ≥ 80, amarillo ≥ 60 y rojo < 60.
- Esos cortes vienen de la escala original de 171 puntos (85/65). En la escala normalizada 0–100, Visual Studio usa **≥ 20 verde, 10–19 amarillo, < 10 rojo**.
- Resultado en el repo: **69 de 91 módulos (76 %) en rojo**, 18 en amarillo y 4 en verde. El MI promedio del proyecto es 45,2, así que la regla falla. Cualquier proyecto con archivos de más de ~150 líneas la fallará.

**Sobre la métrica en sí:** el MI está desgastado incluso bien calculado. Heitlager, Kuipers y Visser (2007) lo descartaron por no ser accionable: un número bajo no dice qué arreglar. Sjøberg, Anda y Mockus (2012) encontraron que, de las métricas estructurales que estudiaron, solo el tamaño predecía el esfuerzo de mantenimiento, de forma consistente. Es decir, **el MI de SAAC hoy es una medida de tamaño con otro nombre**.

**Recomendación:**
- Opción A, la recomendada: eliminar el MI como métrica principal y mostrar por separado tamaño, complejidad cognitiva por función, duplicación y acoplamiento, al estilo del modelo SIG. Cada valor alto dice qué hacer.
- Opción B: implementar Halstead de verdad (contar operadores y operandos en el AST; tree-sitter lo permite), calcular por función y usar los umbrales de la escala normalizada.

---

### H2. La CLI de CI no analiza nada

`cli/saac-cli.js` lee `.saac/rules.json` y luego construye el resultado con valores fijos:

```js
const result = {
  fitnessScore: 100,
  passedRules: rules.length,
  failedRules: 0,
  violations: [],
};
```

No llama al motor, no lee ningún AMG y sale siempre con código 0. Si alguien la pone en GitHub Actions, el pipeline **siempre pasa**. En una defensa o en una demo esto es lo más peligroso del sistema: promete una función que no existe.

**Recomendación:** o se conecta al motor real (ver la sección 6.3), o se retira de la documentación hasta que funcione.

---

### H3. Imports TS/JS ambiguos se pierden del Ca/Ce

- El worker de Node resuelve cada import a la **ruta absoluta exacta** del módulo (`import-resolver.ts`, con `path.resolve` y la regla `dir → dir/index`).
- El agregador solo trata como relativos los imports que empiezan con `./` o `../` (`aggregator.rs:237`). Los de TS llegan ya absolutos (`D:/…/src/components/supplementary-diagrams/index`), así que caen en `resolve_by_basename` (`aggregator.rs:578`).
- Esa función solo resuelve si el **último segmento** es único en todo el proyecto. Con `index`, `utils`, `main`, `helpers` o `types` hay varios candidatos, así que la dependencia se descarta del Ca/Ce. Se conserva como arista "externa", pero no participa en las métricas.

**Evidencia:** 9 módulos tienen Ca guardado distinto del Ca que sale de su propia lista de dependencias. Los 9 son barrels `index`:

```
src/components/adrs/index                  Ca guardado 0, real 1
src/components/antipatterns/index          0 / 1
src/components/c4viewer/index              0 / 1
src/components/dashboard/index             0 / 1
src/components/design/index                0 / 1
src/components/metrics/index               0 / 1
src/components/supplementary-diagrams/index 0 / 1
workers/node/src/extractors/index          0 / 1
workers/node/src/metrics/index             0 / 1
```

Cada caso también resta del Ce del módulo que importa. El caso más visible es `layout/AppShell`: importa 17 módulos, pero su Ce queda en 11 porque pierde los 6 imports a `dashboard/index`, `metrics/index`, `c4viewer/index`, `antipatterns/index`, `adrs/index` y `design/index`. Esto afecta a la inestabilidad (I), a la distancia (D), al God Module, a la detección de ciclos (un ciclo que pase por un `index` no se detecta) y a los diagramas.

Riesgo adicional: si el archivo exacto no se analizó, por ejemplo porque está en una carpeta ignorada, y existe **otro** archivo con el mismo nombre, el fallback crea una arista falsa hacia el archivo equivocado.

**Recomendación:** en el agregador, antes de cualquier fallback, si `dep.target` coincide exactamente con un `module_id` conocido, usarlo directamente. Agregar un test con dos `index` en carpetas distintas.

---

### H4. Los re-exports de barrels no cuentan como dependencias

El parser de TS solo registra `ImportDeclaration` e `import()` dinámico (`typescript.ts:780` y `:796`). No registra `ExportDeclaration` con `moduleSpecifier` (`export * from './X'`, `export { A } from './X'`).

`src/components/supplementary-diagrams/index.ts` re-exporta 15 vistas. En el AMG ese barrel tiene **0 imports**, así que las 15 vistas aparecen con Ca = 0. Junto con H3, la cadena `c4viewer → barrel → vistas` queda cortada por los dos lados.

**Evidencia:** 39 de 91 módulos tienen Ca = 0 y 16 están completamente aislados (Ca = Ce = 0). Descontando los puntos de entrada legítimos (`main`, `vite.config`, CLI, fixtures), la mayoría son vistas detrás de barrels.

**Consecuencias:**
- Cualquier detector de "código muerto" o de "módulos sin uso" daría falsos positivos.
- La inestabilidad de esas vistas sale 1 o 0 sin razón.
- El grafo de fuerzas y el diagrama de paquetes muestran islas que no existen.

**Recomendación:** tratar `export … from` como dependencia de tipo `import` (o un tipo nuevo `reexport`) en el parser de TS.

---

### H5. Abstracción y distancia no tienen sentido en TypeScript

`typescript.ts:411`:

```ts
isAbstract: isAbstractClass || isInterfaceNode,
```

Cada `interface` se cuenta como clase abstracta. En TS/React casi todo archivo declara interfaces (props, estados, DTOs), así que:

| Medida | Valor |
|---|---|
| Mediana de A (abstracción) | **1,00** |
| A promedio del proyecto | 0,59 |
| Clases totales | 135, en un proyecto con muy pocas clases reales: la mayoría son interfaces |
| `Leftbar.tsx` | A = 1 solo por `interface TreeNode` → D = 0,857, es decir, "zona de inutilidad" |
| `shared/types.ts` | 52 "clases" (interfaces), LCOM4 = 52 |
| Módulos con A = 0 | 46; en todos ellos D = 1 − I, así que no aporta información nueva |

Además, Robert C. Martin definió A, I y D para **paquetes o componentes** (unidades de despliegue y reutilización), no para archivos sueltos. Por archivo, la "secuencia principal" no tiene interpretación arquitectónica.

**Recomendación:**
- Excluir interfaces o tipos puros del cálculo de A en TS, o contar como abstractos solo los que se implementan (`implements`).
- Calcular A, I y D **agregados por carpeta o componente C4** (nivel 3), que es donde Martin las definió.
- No calcular LCOM4 para interfaces; no tiene sentido sin métodos con cuerpo.

---

### H6. `moduleCohesion` no mide cohesión

Definición en `aggregator.rs`: `moduleCohesion = Ce / total_imports`, es decir, la proporción de imports que resolvieron a un módulo interno.

- El worker de TS solo guarda imports internos (los paquetes npm devuelven `null` en `import-resolver.ts:31`), así que la proporción es casi siempre 1.
- **86 de 91 módulos tienen `moduleCohesion = 1`**. Los 5 restantes no son menos cohesivos: valen menos de 1 porque perdieron imports por H3 o porque importan CSS:

  | Módulo | Valor | Causa |
  |---|---|---|
  | `layout/AppShell` | 0,65 | 6 de sus 17 imports apuntan a barrels `index` y se descartaron (H3) |
  | `c4viewer/index` | 0,89 | el import a `supplementary-diagrams/index` se descartó (H3) |
  | `parsers/typescript` (worker) | 0,33 | 2 imports a `index` descartados (H3) |
  | `design/index` | 0 | solo importa `design.css` |
  | `src/main` | 0,5 | importa `index.css` |

La cohesión es una propiedad **interna** del módulo: cuánto se relacionan sus elementos entre sí. Esta métrica mide otra cosa y se llama como algo que no es.

**Recomendación:** eliminarla o renombrarla a "cobertura de resolución de imports" (sin contar CSS ni assets). Como muestra la tabla, eso sí es útil: es justo la señal que delató el error H3, y sirve como indicador de confianza del análisis (ver la sección 6.1).

---

### H7. Antipatrones declarados sin detector

`amg.rs:202` declara 7 tipos, pero `aggregator.rs` solo produce 3:

| Tipo | Detector |
|---|---|
| `CircularDependency` | Sí (Tarjan) |
| `GodModule` | Sí, pero **solo por Ce** (más de 15, o más del 20 % de las dependencias internas con Ce ≥ 8) |
| `LayerViolation` | Sí, por **nombres de carpeta** (`controllers`, `services`…) |
| `ShotgunSurgery` | **No**; requiere historia de git |
| `FeatureEnvy` | **No** |
| `LollipopProblem` | **No** |
| `ConcreteClassDependency` | **No** |

En el propio repo el resultado es **0 antipatrones**. Para un proyecto con componentes de CC 39 en una sola función y un archivo de tipos del que dependen 51 módulos, ese "todo bien" no es creíble.

El God Module mira solo el fan-out. Un "módulo dios" clásico es grande, complejo **y** concentra responsabilidades. Un hub con fan-in muy alto (`types.ts`, Ca = 51) es otro patrón (un hub o punto de cambio crítico) que tampoco se reporta.

**Recomendación:** ocultar en la interfaz y en el informe los tipos que no se detectan, e implementar después solo los que tengan una señal confiable. `ShotgunSurgery` sale gratis con el acoplamiento por cambio de git (sección 6.2).

---

### H8. El Fitness Score casi no discrimina

Reglas por defecto (`rules.rs`):

| Regla | Peso | ¿Falla en un proyecto React/TS típico? |
|---|---|---|
| Sin ciclos | 35 | Rara vez, y menos aún por H3 |
| Sin God Modules (Ce ≤ 15) | 25 | Rara vez (Ce máx. del repo: 12) |
| Integridad de capas | 20 | Casi nunca (depende de nombres de carpeta) |
| MI promedio ≥ 60 | 20 | **Casi siempre** (por H1) |

El 80 % del peso son reglas que casi nunca fallan en este tipo de proyecto, y el 20 % restante es una regla que casi siempre falla por el tamaño de los archivos. El resultado es un **80/100 para casi cualquier proyecto React**, sin importar su calidad real.

Además, en el AMG `metrics.fitnessScore` se guarda como 0 (`aggregator.rs`, comentario "no implementado"), y el valor real se calcula aparte en `RulesEngine::evaluate`. El informe necesitó un fallback al historial por esto.

**Recomendación:** recalibrar las reglas después de corregir H1, H3 y H4, añadir reglas que sí discriminen (complejidad cognitiva máxima por función, hubs, dependencias contra la arquitectura declarada) y guardar el fitness real en el AMG.

---

### H9. Estilo arquitectónico y capas por nombre de carpeta

`detect_architecture_style` (`aggregator.rs:1313`) y `detect_layer_violations` (`aggregator.rs:1115`) usan señales de nombres de carpeta. En el propio repo: estilo **"desconocido", confianza 0**. Para proyectos que no siguen convenciones MVC/capas, el resultado no aporta.

**Recomendación:** dejar que el usuario declare las capas o componentes (sección 6.3) en lugar de adivinarlos.

---

## 5. Diagnóstico por métrica: vigente, desgastada o mal aplicada

| Métrica | Estado en la literatura | Estado en SAAC | Veredicto |
|---|---|---|---|
| Complejidad ciclomática | Vigente por función | Bien calculada; se agrega por promedio | Útil; mostrar máximo por función |
| Complejidad cognitiva | Vigente, mejor que CC para lectura | Bien calculada | **La más útil**; darle protagonismo |
| Índice de mantenibilidad | Desgastada, poco accionable | Sin Halstead, umbrales mal calibrados | Reemplazar o rehacer |
| Ca / Ce / Inestabilidad | Vigentes a nivel de componente | Errores de resolución (H3, H4) | Útiles tras corregir; agregar por componente |
| Abstracción / Distancia | Vigentes para paquetes en lenguajes OO | Mal aplicadas a archivos TS | Rehacer por componente o quitar en TS |
| LCOM4 | Vigente para clases OO | Se aplica a interfaces | Limitar a clases con métodos |
| `moduleCohesion` | No es una métrica conocida | Constante | Eliminar o renombrar |
| Fitness Score | Concepto vigente (*Building Evolutionary Architectures*) | Reglas que no discriminan | Recalibrar |

---

## 6. Qué haría la diferencia

### 6.1 Prioridad 1: credibilidad de los números

Sin esto, todo lo demás se apoya en datos dudosos.

1. Corregir H3 (match exacto antes del fallback) y H4 (re-exports). Esfuerzo bajo.
2. Rehacer o reemplazar el MI (H1). Esfuerzo medio con Halstead, bajo si se reemplaza.
3. Abstracción en TS (H5) y A/I/D por componente. Esfuerzo medio.
4. Quitar `moduleCohesion` y ocultar los antipatrones sin detector (H6, H7). Esfuerzo bajo.
5. **Indicador de confianza del análisis:** porcentaje de imports resueltos, módulos aislados y archivos fallidos o ignorados, visible en el dashboard y en el informe. Así el usuario sabe cuánto fiarse.
6. Tests de regresión con proyectos fixture pequeños y valores esperados a mano.

### 6.2 Prioridad 2: evolución con git

Es la señal con más evidencia empírica y el código ya invoca `git` (`git_info.rs`, hoy solo autoría).

- **Puntos calientes:** cambios frecuentes multiplicados por complejidad. Los archivos que cambian mucho **y** son complejos concentran los defectos (Nagappan y Ball, 2005; Tornhill, 2015).
- **Acoplamiento por cambio (logical coupling):** archivos que cambian juntos en los mismos commits **sin** importarse entre sí. Es acoplamiento oculto que ningún análisis estático ve (Gall et al., 1998). Habilita `ShotgunSurgery` de verdad.
- **Riesgo de conocimiento:** módulos que solo conoce una persona (bus factor), usando la autoría que ya se extrae.
- Fuente: `git log --numstat --format=…`, con caché por commit.

### 6.3 Prioridad 3: el código contra la arquitectura declarada

Es lo que más diferenciaría a SAAC.

Hoy `design/comparison.rs` compara un diseño contra el grafo real **nodo a nodo y arista a arista a nivel de archivo**. Es un diff, no una comprobación de conformidad.

La propuesta es un **modelo de reflexión** (Murphy, Notkin y Sullivan, 1995):
1. El usuario declara componentes (grupos de carpetas o globs) y las dependencias permitidas entre ellos, desde el módulo de diseño o desde el C4 nivel 2/3.
2. SAAC proyecta el grafo real sobre esos componentes y reporta:
   - **convergencias:** dependencias reales que el diseño permite;
   - **divergencias:** dependencias reales que el diseño no permite (violaciones);
   - **ausencias:** dependencias del diseño que el código no tiene.
3. Las divergencias pasan a ser reglas de fitness y la **CLI** (H2) las verifica en CI, con anotaciones en el PR.

Con esto los diagramas C4 dejan de ser documentación que envejece y pasan a ser un contrato que se verifica en cada cambio.

---

## 7. Orden sugerido de trabajo

| Paso | Contenido | Hallazgos |
|---|---|---|
| 1 | Correcciones de resolución de imports y tests | H3, H4 |
| 2 | Limpieza de métricas e indicador de confianza | H1, H5, H6, H7 |
| 3 | Recalibrar el Fitness Score y guardarlo en el AMG | H8 |
| 4 | Análisis de evolución con git | Sección 6.2 |
| 5 | Modelo de reflexión y CLI real para CI | H2, H9, sección 6.3 |

---

## 8. Datos de referencia del análisis

AMG `.saac/runs/18cf5f2771cb7890-7b08.json` (26-08-2026):

```
modules 91 (typescript 89, javascript 2)   deps 208 (todas import)
ca                    min 0    p25 0     med 1     p75 1     max 51
ce                    min 0    p25 0     med 2     p75 3     max 12
instability           min 0    p25 0     med 0.67  p75 0.92  max 1
abstractness          min 0    p25 0     med 1.00  p75 1     max 1
distance              min 0    p25 0     med 0.50  p75 0.92  max 1
lcom4                 min 1    p25 1     med 1     p75 1     max 52
maintainabilityIndex  min 14.6 p25 30.0  med 41.2  p75 56.9  max 93.3
ccAvg                 min 1    p25 1     med 5     p75 13.7  max 39
ccMax                 min 1    p25 1     med 6     p75 16    max 44
moduleCohesion        = 1 en 86/91 (los 5 restantes: imports a index perdidos o CSS)
Ca guardado ≠ Ca derivado de dependencies[]: 9 módulos (todos barrels index)

MI < 60: 69   60–80: 18   ≥ 80: 4
Ca = 0: 39    Ce = 0: 24    aislados (Ca = Ce = 0): 16
antipatrones: 0    estilo: unknown (confianza 0)    fitnessScore guardado: 0
contenedores: 2    sistemas externos: 0    actores: 1
```

Las cifras se reproducen con un script de Node que lee el JSON del run y calcula percentiles, correlaciones de Pearson y Spearman, y compara el Ca guardado con el Ca derivado de `dependencies[]`.

---

## 9. Referencias

- Coleman, D., Ash, D., Lowther, B., Oman, P. (1994). *Using Metrics to Evaluate Software System Maintainability*. IEEE Computer 27(8).
- Heitlager, I., Kuipers, T., Visser, J. (2007). *A Practical Model for Measuring Maintainability*. QUATIC 2007.
- Sjøberg, D., Anda, B., Mockus, A. (2012). *Questioning Software Maintenance Metrics: A Comparative Case Study*. ESEM 2012.
- Microsoft. *Code metrics – Maintainability index range and meaning* (documentación de Visual Studio).
- Martin, R. C. (1994). *OO Design Quality Metrics: An Analysis of Dependencies*; y *Agile Software Development: Principles, Patterns, and Practices* (2002).
- Chidamber, S., Kemerer, C. (1994). *A Metrics Suite for Object Oriented Design*. IEEE TSE 20(6). Hitz, M., Montazeri, B. (1995), para LCOM4.
- Campbell, G. A. (2018). *Cognitive Complexity: A New Way of Measuring Understandability*. SonarSource.
- Nagappan, N., Ball, T. (2005). *Use of Relative Code Churn Measures to Predict System Defect Density*. ICSE 2005.
- Gall, H., Hajek, K., Jazayeri, M. (1998). *Detection of Logical Coupling Based on Product Release History*. ICSM 1998.
- Tornhill, A. (2015). *Your Code as a Crime Scene*. Pragmatic Bookshelf.
- Murphy, G., Notkin, D., Sullivan, K. (1995). *Software Reflexion Models: Bridging the Gap between Source and High-Level Models*. FSE 1995.
- Ford, N., Parsons, R., Kua, P. (2017). *Building Evolutionary Architectures*. O'Reilly.
