# SAAC v2.0 — Sistema de Diseño

Fuente única de verdad para la identidad visual del proyecto.
Todo componente nuevo debe referenciar este documento; no improvisar colores, tipografías ni espaciados ad-hoc.

---

## 1. Personalidad

| Eje | Valor |
|---|---|
| Género | Atmospheric / IDE-tool |
| Tono | Técnico, denso, profesional — nunca "amigable casual" |
| Densidad | Alta — es una herramienta de ingeniería, no un marketing site |
| Movimiento | Mínimo: transiciones CSS de 150–200 ms, sin animaciones llamativas |

**Mantra de diseño:** La interfaz debe sentirse como un instrumento de precisión — como un IDE, no como un dashboard corporativo.

---

## 2. Paleta de Color

Todos los colores se definen como custom properties en `src/index.css` y se consumen vía `var(--nombre)`. Prohibido usar hex/rgb sueltos en componentes.

### 2.1 Superficies (oscuro → claro)

| Token | Hex | Uso |
|---|---|---|
| `--bg-dark` | `#090b10` | Fondo raíz de la app (`body`) |
| `--panel-dark` | `#121520` | Paneles laterales, tarjetas, popovers |
| `--panel-border` | `#1e2333` | Bordes entre paneles y secciones |
| `--panel-border-light` | `#2a3147` | Bordes hover, separadores internos |

### 2.2 Acentos semánticos

Cada acento tiene un rol fijo. No intercambiar.

| Token | Hex | Rol |
|---|---|---|
| `--accent-blue` | `#3b82f6` | Acción primaria (botones, tabs activos, enlaces) |
| `--accent-cyan` | `#06b6d4` | Identidad de marca SAAC, niveles C4, consola |
| `--accent-emerald` | `#10b981` | Éxito, salud, Fitness Score alto, MI ≥ 80 |
| `--accent-amber` | `#f59e0b` | Advertencia, antipatrones, MI 60–79 |
| `--accent-rose` | `#f43f5e` | Error, cancelación, MI < 60, severidad crítica |
| `--accent-purple` | `#8b5cf6` | Historial, contenedores C4, datos secundarios |

### 2.3 Texto

| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#f3f4f6` | Texto principal — títulos, etiquetas activas |
| `--text-secondary` | `#9ca3af` | Texto de soporte — descripciones, subtítulos |
| `--text-muted` | `#6b7280` | Texto inactivo — placeholders, metadata |

### 2.4 Reglas de Color

- **Gradientes de marca:** `from-blue-600 to-cyan-600` para CTAs primarios (botón "Analizar").
- **Gradientes de logo:** `from-blue-500 via-cyan-400 to-emerald-400` solo para el ícono/badge SAAC.
- **Glows:** Se permiten `box-shadow` con alpha 0.20–0.25 del color de acento correspondiente sobre elementos interactivos en hover/focus. Nunca en reposo.
- **Glassmorphism:** `backdrop-filter: blur(12px)` con fondo rgba del panel-dark al 85% de opacidad. Reservado para headers, popovers y tooltips flotantes — no abusar.

---

## 3. Tipografía

### 3.1 Familias

| Rol | Fuente | Fallback | Pesos permitidos |
|---|---|---|---|
| Display + Body | [Inter](https://fonts.google.com/specimen/Inter) | system-ui, -apple-system, sans-serif | 300 · 400 · 500 · 600 · 700 · 800 |
| Código + Datos | [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | ui-monospace, SFMono-Regular, monospace | 400 · 500 · 600 · 700 |

### 3.2 Escala de tamaño

SAAC es una aplicación de escritorio (Tauri), no un sitio web. Los tamaños son compactos.

| Nivel | Tamaño | Peso | Uso |
|---|---|---|---|
| Display | `text-2xl` – `text-3xl` (1.5–1.875rem) | 800 (extrabold) | Solo pantalla de bienvenida |
| Título de sección | `text-sm` (0.875rem) | 700 (bold) | Headers de paneles |
| Cuerpo | `text-xs` (0.75rem) | 400–500 | Todo el contenido dentro de paneles |
| Micro | `text-[11px]` – `text-[10px]` | 400–600 | Badges, metadata, indicadores MI |
| Código | `text-xs` font-mono | 400–500 | Paths, IDs, valores numéricos, consola |

### 3.3 Reglas tipográficas

- **No cursivas en títulos ni headings.** Nunca `font-style: italic` en display ni sección.
- **Énfasis:** Usar peso (semibold/bold) o color de acento. No itálicas.
- **Tracking:** `tracking-tight` en display; `tracking-wide` o `tracking-wider` solo en labels tipo `UPPERCASE` de 10px.
- **Truncamiento:** Nombres de archivos y paths usan `truncate` (ellipsis). IDs de módulos usan `break-all`.

---

## 4. Espaciado y Layout

### 4.1 Escala base

Sistema de 4px. Usar clases Tailwind estándar (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px).

### 4.2 Estructura IDE (5 regiones)

```
┌──────────────────────────────────────────────────────┐
│                     TopBar (h-12)                     │
├──────────────────────────────────────────────────────┤
│               BreadcrumbBar (h-8, C4 only)           │
├────────┬─────────────────────────────┬───────────────┤
│        │                             │               │
│ Leftbar│       Main Canvas           │   Rightbar    │
│ (w-64) │       (flex-1)              │   (w-72)      │
│        │                             │               │
├────────┴─────────────────────────────┴───────────────┤
│                   Downbar (h-56)                      │
├──────────────────────────────────────────────────────┤
│                   StatusBar (h-6)                     │
└──────────────────────────────────────────────────────┘
```

### 4.3 Bordes y separadores

- Todos los bordes entre paneles: `border-[#1e2333]` (1px solid).
- Separadores internos dentro de un panel: `border-[#1f2433]` o `border-[#232838]`.
- Nunca usar bordes de más de 1px. Sin box-shadows para separar paneles (solo para glows interactivos).

### 4.4 Radios de borde

| Elemento | Radio |
|---|---|
| Botones de acción | `rounded-md` (6px) |
| Tarjetas / Cards | `rounded-lg` (8px) |
| Badges / Pills | `rounded-full` |
| Contenedores grandes | `rounded-xl` (12px) |
| Logo SAAC | `rounded-lg` exterior, `rounded-[6px]` interior |

---

## 5. Interacciones y Estados

### 5.1 Botones

| Estado | Tratamiento |
|---|---|
| Default | Fondo semitransparente del acento (`bg-blue-600/20`) + borde sutil |
| Hover | Fondo ligeramente más opaco (`bg-blue-600/30`) + texto más claro |
| Active | `transform: translateY(1px)` (feedback táctil) |
| Disabled | `opacity: 0.4`, cursor default |
| Loading | `animate-pulse` en el botón completo |

### 5.2 Pestañas (Tabs)

| Estado | Tratamiento |
|---|---|
| Inactiva | `text-gray-400`, sin fondo, `border-transparent` |
| Hover | `text-gray-200`, fondo `hover:bg-[#161a26]` |
| Activa | `text-{acento}-400`, fondo `bg-[#161a26]`, `border-b-2 border-{acento}-500` |

### 5.3 Items de lista (Explorador, Módulos)

| Estado | Tratamiento |
|---|---|
| Default | `text-gray-300`, sin fondo |
| Hover | `bg-[#1a1e2c]`, `text-white` |
| Selected | `bg-blue-600/30`, `text-blue-300`, `border border-blue-500/40` |

### 5.4 Focus visible

Usar `focus:outline-none focus:border-{acento}-500` en inputs. Botones: `focus-visible:ring-2 ring-{acento}-500/50`.

---

## 6. Iconografía

- **Librería:** [Lucide React](https://lucide.dev/) — todos los íconos provienen de aquí.
- **Tamaño estándar:** `w-3.5 h-3.5` (14px) en barras y tabs, `w-4 h-4` (16px) en acciones principales.
- **Color:** Heredan el color del texto del padre, o usan el acento semántico correspondiente.
- **No usar:** íconos de otras librerías, emojis como íconos funcionales (emojis solo en labels de texto como el dropdown de diagramas), ni SVGs custom inline.

---

## 7. Scrollbars

```css
::-webkit-scrollbar         { width: 6px; height: 6px; }
::-webkit-scrollbar-track   { background: #0d0f16; }
::-webkit-scrollbar-thumb   { background: #252c3f; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #3b4663; }
```

Delgadas (6px), oscuras, sin bordes. Nunca las scrollbars nativas del sistema.

---

## 8. Convenciones de Componentes

### 8.1 Nombres de archivo

- Componentes de layout: `src/components/layout/{PascalCase}.tsx`
- Componentes de dominio: `src/components/{dominio}/{PascalCase}.tsx`
- Stores: `src/stores/use{Dominio}Store.ts`

### 8.2 Cómo agregar un color nuevo

1. Definir el token en `src/index.css` dentro de `:root` con nombre semántico.
2. Documentarlo en este archivo (sección 2).
3. Usar `var(--nombre)` o la clase Tailwind equivalente en el componente.
4. **Nunca** hex/rgb inline en un `.tsx`.

### 8.3 Cómo agregar una fuente nueva

No agregar. El sistema tipográfico de SAAC es Inter + JetBrains Mono. Si surge una necesidad real, discutirlo primero y actualizar este documento.

---

## 9. Anti-patrones (prohibidos)

| Anti-patrón | Por qué |
|---|---|
| Cursivas en headings | Tell de IA, destruye la jerarquía visual |
| Chrome falso (barras de navegador, marcos de teléfono) | SAAC es una app de escritorio real, no un mockup |
| Métricas inventadas ("10× más rápido") | Todo dato visible debe provenir del AMG real |
| Gradientes arcoíris | Fuera de tono para una herramienta técnica |
| Bordes > 1px entre paneles | El diseño es denso; bordes gruesos rompen el flujo |
| `font-family` inline en componentes | Siempre vía tokens o clases Tailwind |
| Animaciones de más de 300ms | La app debe sentirse instantánea |
| Sombras prominentes en paneles | Solo glows sutiles en elementos interactivos |
