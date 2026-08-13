# GraphForge — Design System & UI Specification

> Professional desktop workspace for graph visualization, structural analysis and technical data exploration.

---

## 1. Design Philosophy

GraphForge is designed as a **professional engineering workspace**, not as a traditional dashboard.

The interface should communicate:

- Technical precision
- High information density
- Professional tooling
- Structural organization
- Developer-oriented workflows
- Data visualization
- Reliability
- Configurability

The visual language takes inspiration from professional desktop development tools, graph editors and engineering software.

It should feel like a product that a technical user could work with for several hours.

### Core principle

> **The interface should disappear behind the work.**

The graph, data and analysis are the primary focus. UI elements should support the workflow without competing with the content.

---

# 2. Product Personality

### Keywords

```text
Professional
Technical
Dense
Precise
Dark
Structured
Minimal
Interactive
Engineering-oriented
Reliable
```

Avoid:

```text
Playful
Marketing-heavy
Oversaturated
Rounded-everything
Large empty spaces
Excessive gradients
Generic SaaS dashboard aesthetics
```

---

# 3. Application Structure

The application uses a persistent desktop workspace.

```text
┌───────────────────────────────────────────────────────────────┐
│                         TOP BAR                               │
├───┬────────────────┬──────────────────────────────┬───────────┤
│ A │                │                              │           │
│ C │                │                              │           │
│ T │    EXPLORER    │         MAIN WORKSPACE       │ INSPECTOR │
│ I │                │                              │           │
│ V │                │                              │           │
│ I │                │                              │           │
│ T │                ├──────────────────────────────┤           │
│ Y │                │       BOTTOM PANEL           │           │
├───┴────────────────┴──────────────────────────────┴───────────┤
│                         STATUS BAR                            │
└───────────────────────────────────────────────────────────────┘
```

The main layout consists of:

1. Top navigation
2. Activity bar
3. Explorer
4. Main workspace
5. Inspector
6. Bottom utility panel
7. Status bar

---

# 4. Global Layout

Recommended desktop breakpoint:

```text
Minimum functional width: 1024px
Recommended width: 1440px+
Primary design target: 1600 × 900
```

Grid:

```css
grid-template-columns:
    46px
    218px
    minmax(0, 1fr)
    275px;
```

Meaning:

| Area | Width |
|---|---:|
| Activity bar | 46px |
| Explorer | 218px |
| Main workspace | Flexible |
| Inspector | 275px |

The center workspace must always receive the largest available space.

---

# 5. Color System

GraphForge uses a near-black neutral palette.

## Background

```css
--bg: #0B0D10;
--panel: #101318;
--panel-2: #13171D;
--panel-3: #171C23;
```

### Borders

```css
--border: #252B34;
--border-soft: #1D222A;
```

Borders should be subtle.

Never use pure white borders.

---

## Typography colors

```css
--text: #E6E9ED;
--muted: #858C98;
--muted-2: #5F6671;
```

Hierarchy:

```text
Primary content
    #E6E9ED

Secondary content
    #858C98

Metadata
    #5F6671
```

---

# 6. Accent Colors

Purple is the primary interaction color.

```css
--purple: #8B7CFF;
--purple-soft: #211E39;
```

Additional semantic colors:

```css
--cyan: #45C8DF;
--green: #4FD49A;
--yellow: #E7B85B;
--red: #EF6B73;
--orange: #EF925C;
```

### Usage

| Color | Meaning |
|---|---|
| Purple | Primary selection / active state |
| Cyan | Data / external / information |
| Green | Healthy / database / success |
| Yellow | Warning |
| Red | Error |
| Orange | Processing / external / worker |

Do not use all colors simultaneously for decoration.

Colors should communicate meaning.

---

# 7. Typography

Primary font:

```text
Inter
```

Fallback:

```text
ui-sans-serif
-apple-system
BlinkMacSystemFont
"Segoe UI"
sans-serif
```

Monospace areas:

```text
SFMono-Regular
Consolas
Monaco
monospace
```

### Suggested scale

```text
Brand:       13px
Navigation:  11px
Panel title: 10px
Body:        11px
Metadata:     9px
Status:       8px
```

The UI intentionally uses small typography because the application is information-dense.

---

# 8. Border Radius

Use restrained rounding.

```text
Small controls: 4px
Buttons:        5px
Panels:         6px
Cards:          6px
Node preview:   8px
```

Avoid excessive `border-radius: 999px`.

Pills should only be used for status indicators.

---

# 9. Spacing System

Base unit:

```text
4px
```

Recommended spacing:

```text
4px
6px
8px
10px
12px
14px
18px
24px
```

Panel padding:

```text
12px – 14px
```

Compact controls:

```text
6px – 8px
```

---

# 10. Top Bar

Height:

```text
48px
```

Structure:

```text
[ Brand ]                 [ File Edit Graph View Analyze Help ]                 [ Status Icons ]
```

### Brand

Contains:

- Product icon
- Product name
- Optional version

Example:

```text
[GF] GraphForge v1.8.2
```

The brand mark should be compact.

---

## Navigation

Menu items:

```text
File
Edit
Graph
View
Analyze
Help
```

Inactive:

```text
#8B919B
```

Hover:

```text
#DFE2E7
```

Background on hover:

```text
#171B21
```

---

# 11. Activity Bar

Width:

```text
46px
```

Position:

```text
Left
```

Purpose:

Switch between major application contexts.

Example:

```text
◈ Explorer
⬡ Graph
◌ Analysis
▣ Data
◇ History
```

Bottom:

```text
?
⚙
```

Active item:

```text
color: #E6E9ED
```

Add a 2px vertical purple indicator on the left.

---

# 12. Explorer

Width:

```text
218px
```

Purpose:

Project navigation.

Typical structure:

```text
GRAPHFORGE

▾ src
    graph.ts
    nodes.ts
    edges.ts
    analyzer.ts
    layout.ts

▾ datasets
    topology.json
    services.json
    graph.db

▸ analysis

README.md
graphforge.json
```

The explorer should visually resemble a professional project tree.

---

# 13. File Tree

File states:

### Default

```text
color: #828995
```

### Hover

```text
background: #181C22
color: #D7DBE0
```

### Active

```text
background: #1D1B30
color: #C4BFFF
```

File icons should communicate file type.

Examples:

```text
TypeScript → blue
JSON       → yellow
Database   → green
Graph      → purple
Markdown   → neutral
```

---

# 14. Main Workspace

The center area is the application's primary content region.

Structure:

```text
Tabs
Toolbar
Canvas
Bottom panel
```

The canvas must receive the majority of the vertical space.

---

# 15. Tabs

Height:

```text
39px
```

Example:

```text
[ ◈ graph.ts × ]
[ {} topology.json × ]
[ ◌ network.graph × ]
```

Active tab:

```text
background: #12161B
color: #DCE0E5
```

Add a subtle 1px purple top indicator.

Inactive tabs should remain visually quiet.

---

# 16. Graph Toolbar

Height:

```text
43px
```

Example:

```text
[↖ Select]
[＋ Node]
[⤢ Edge]
│
[◇ Layout]
[◎ Fit]

                                [Force]
                                [2D ▾]
                                [...]
```

Toolbar buttons should be compact.

Default:

```text
transparent
```

Hover:

```text
#171B21
border: #252B34
```

Active:

```text
background: #211F35
border: #302C51
color: #B8B0FF
```

---

# 17. Graph Canvas

The graph canvas is the visual centerpiece.

Background:

```text
#0B0E12
```

Optional subtle radial glow:

```text
rgba(90,80,170,.055)
```

Do not use a strong gradient.

The graph should appear to float inside a technical workspace.

---

# 18. Graph Nodes

Nodes represent entities.

Example types:

```text
Service
Database
User
Event
External API
Worker
Storage
Queue
```

Recommended visual structure:

```text
       ●
   API Gateway
```

Node:

```text
width: 42px
height: 42px
```

Border:

```text
2px
```

Labels:

```text
9px
```

---

# 19. Node Color Mapping

Recommended semantic system:

```text
Service
    Purple

Database
    Green

Event
    Cyan

Worker
    Orange

External
    Orange

User
    Cyan
```

The node color should identify its category.

---

# 20. Node Selection

Selected nodes should become visually obvious.

Use:

```css
border-width: 3px;
border-color: #A99FFF;
```

Optional glow:

```text
purple
18px blur
low opacity
```

Selected node may increase from:

```text
42px → 48px
```

This creates a clear hierarchy without excessive animation.

---

# 21. Graph Edges

Edges represent relationships.

Default:

```text
#3B424D
```

Opacity:

```text
0.65
```

Width:

```text
1px – 1.5px
```

Arrow:

```text
triangle
```

Selected edge:

```text
#8B7CFF
2px+
opacity: 1
```

---

# 22. Graph Layouts

The application should conceptually support:

```text
Force
Hierarchical
Tree
Radial
Grid
Organic
```

The currently active layout should be visually indicated.

---

# 23. Graph Controls

Bottom-right controls:

```text
[ − ] [ 87% ] [ + ]
```

Recommended zoom range:

```text
35% → 250%
```

Also provide:

```text
Fit
Center
Reset
```

Keyboard shortcuts can be supported:

```text
+
-
0
F
```

---

# 24. Minimap

Position:

```text
Top-right
```

Approximate size:

```text
150 × 90px
```

Purpose:

Provide orientation inside large graphs.

The minimap should be visually subordinate.

Opacity:

```text
0.85 – 0.9
```

Avoid turning it into a second major interface.

---

# 25. Graph Information Pills

Position:

```text
Top-left of canvas
```

Example:

```text
Nodes 1,284
Edges 4,821
Density 0.29%
```

Style:

```text
background: rgba(15,19,24,.88)
border: #252B34
```

Typography:

```text
8px
```

Labels should be muted.

Values should be brighter.

---

# 26. Inspector

Width:

```text
275px
```

Position:

```text
Right
```

Purpose:

Display details about the selected graph object.

Structure:

```text
Inspector

[ Node Icon ] API Gateway
              Service · node_042

Properties

Type          service
Status        active
Environment   production
Version       4.8.2
Region        us-east-1

Metrics

Requests      84.2k
Latency       42ms
Errors        0.08%
Uptime        99.98%

Connections

● Auth Service
● PostgreSQL
● Event Bus
● Analytics
```

---

# 27. Inspector Properties

Use a two-column layout:

```text
Property       Value
```

Example:

```text
Type           service
Status         active
Environment    production
Version        4.8.2
```

Property names:

```text
#606873
```

Values:

```text
#AEB4BC
```

Important values can use semantic colors.

---

# 28. Metrics

Metrics should be displayed in compact cards.

Example:

```text
┌──────────────┐ ┌──────────────┐
│ Requests     │ │ Latency      │
│ 84.2k        │ │ 42ms         │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│ Errors       │ │ Uptime       │
│ 0.08%        │ │ 99.98%       │
└──────────────┘ └──────────────┘
```

Card:

```text
background: #14181E
border: #1D222A
radius: 6px
```

---

# 29. Connections

Connections should be displayed as a compact list.

Example:

```text
● Auth Service                 →
● PostgreSQL                   →
● Event Bus                    →
● Analytics                    →
```

Hover:

```text
background: #181C22
```

This allows users to quickly navigate relationships.

---

# 30. Bottom Panel

Height:

```text
166px
```

Purpose:

Provide secondary technical information without leaving the main workspace.

Tabs:

```text
TERMINAL
PROBLEMS
OUTPUT
LOGS
QUERIES
```

Active:

```text
purple bottom border
```

---

# 31. Terminal

Terminal content should use monospace typography.

Example:

```text
$ graphforge analyze topology.json

14:32:04  Loading graph topology...
14:32:05  Processing 1,284 nodes and 4,821 edges

✓ Graph analysis completed in 184ms

14:32:05  6 clusters detected · 12 isolated nodes
```

Prompt:

```text
#8B7CFF
```

Success:

```text
#4FD49A
```

Metadata:

```text
#545C67
```

---

# 32. Status Bar

Height:

```text
23px
```

The status bar should always communicate application state.

Example:

```text
● Ready
Nodes 1,284
Edges 4,821
Selected node_042

                         Zoom 87%
                         UTF-8
                         GraphForge 1.8.2
```

Background:

```text
#17152C
```

This is one of the few areas where a slightly purple background is acceptable.

---

# 33. Context Menu

Context menus should be compact.

Example:

```text
Inspect node
Trace connections
Find dependencies

----------------

Focus graph
```

Width:

```text
155px
```

Background:

```text
#171B21
```

Border:

```text
#303640
```

Shadow:

```text
0 12px 35px rgba(0,0,0,.45)
```

---

# 34. Interaction Principles

The application should feel responsive without being flashy.

### Hover

Use subtle:

```text
background change
border appearance
text brightness
```

### Selection

Use:

```text
accent color
border
subtle glow
```

### Focus

Use:

```text
purple outline
```

### Loading

Use:

```text
small progress indicator
```

Avoid large spinners.

---

# 35. Motion

Animations should be short.

Recommended:

```text
100ms
150ms
200ms
300ms
```

Graph layout animation:

```text
400ms – 700ms
```

Do not animate every interface element.

Motion should communicate state changes.

---

# 36. Responsive Behavior

Desktop is the primary target.

At:

```text
≤ 1050px
```

Reduce:

```text
Explorer width
Inspector width
```

At:

```text
≤ 800px
```

Hide:

```text
Explorer
Inspector
```

Keep:

```text
Activity bar
Main workspace
```

The graph should remain usable.

---

# 37. Component Architecture

If implemented in React, components should be divided conceptually as follows:

```text
App
│
├── TopBar
│
├── Workspace
│   │
│   ├── ActivityBar
│   │
│   ├── Explorer
│   │   ├── ProjectTree
│   │   ├── FileItem
│   │   └── Outline
│   │
│   ├── MainWorkspace
│   │   ├── EditorTabs
│   │   ├── GraphToolbar
│   │   ├── GraphCanvas
│   │   ├── GraphControls
│   │   ├── MiniMap
│   │   └── BottomPanel
│   │
│   └── Inspector
│       ├── NodePreview
│       ├── Properties
│       ├── Metrics
│       └── Connections
│
└── StatusBar
```

---

# 38. State Architecture

A real implementation should conceptually maintain state for:

```text
activeFile
selectedNode
selectedEdge
zoom
graphLayout
activeTool
activePanel
explorerSelection
graphFilters
terminalOutput
inspectorData
```

Example:

```typescript
type GraphState = {
  selectedNode: string | null;
  selectedEdge: string | null;
  zoom: number;
  layout: GraphLayout;
  activeTool: GraphTool;
};
```

---

# 39. Graph Data Model

A generic graph model:

```typescript
type GraphNode = {
  id: string;
  label: string;
  type: NodeType;
  metadata?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type?: EdgeType;
  metadata?: Record<string, unknown>;
};
```

This makes the UI adaptable to many domains.

---

# 40. Adaptability

The GraphForge visual system can be reused for:

### Software architecture

```text
API
Service
Database
Queue
Worker
External system
```

### Knowledge graphs

```text
Person
Concept
Document
Organization
Topic
```

### Network analysis

```text
Router
Server
Client
Gateway
Network
```

### Financial relationships

```text
Account
Transaction
Company
Asset
Portfolio
```

### Dependency analysis

```text
Package
Module
Library
Component
Function
```

The UI should remain the same while node semantics change.

---

# 41. Empty State

When no graph is loaded:

```text
        No graph loaded

     Open a project or dataset
     to begin exploring relationships.

        [ Open Graph ]
```

Keep the empty state minimal.

Do not turn it into a marketing page.

---

# 42. Loading State

Recommended:

```text
Loading topology...
Analyzing 1,284 nodes...
Calculating relationships...
```

Use a small progress indicator.

The canvas should remain visible if possible.

---

# 43. Error State

Example:

```text
Unable to load graph

topology.json contains invalid
relationship data.

[ View Problems ]
```

Errors should explain:

1. What happened
2. Why it happened
3. What the user can do

---

# 44. Accessibility

Interactive controls should have:

```text
aria-label
```

Keyboard navigation should be supported.

Minimum contrast should be maintained despite the dark theme.

Do not rely solely on color to communicate graph state.

Use:

```text
color + icon
color + label
color + border
```

---

# 45. Visual Density

GraphForge intentionally uses **high information density**.

However:

> High density does not mean visual chaos.

Use:

```text
small typography
consistent spacing
clear alignment
subtle borders
strong hierarchy
```

Avoid:

```text
large cards
giant headings
excessive whitespace
decorative graphics
```

---

# 46. Design Tokens

Recommended central token definition:

```css
:root {

  --color-bg:
    #0B0D10;

  --color-panel:
    #101318;

  --color-panel-secondary:
    #13171D;

  --color-panel-tertiary:
    #171C23;

  --color-border:
    #252B34;

  --color-border-soft:
    #1D222A;

  --color-text:
    #E6E9ED;

  --color-muted:
    #858C98;

  --color-muted-2:
    #5F6671;

  --color-primary:
    #8B7CFF;

  --color-primary-soft:
    #211E39;

  --color-success:
    #4FD49A;

  --color-info:
    #45C8DF;

  --color-warning:
    #E7B85B;

  --color-danger:
    #EF6B73;

  --color-orange:
    #EF925C;

  --radius-sm:
    4px;

  --radius-md:
    6px;

  --radius-lg:
    8px;

}
```

---

# 47. Visual Hierarchy

Every screen should follow this hierarchy:

```text
1. Main graph / primary content
2. Selected object
3. Inspector
4. Navigation
5. Secondary information
6. Metadata
```

The graph must always remain visually dominant.

---

# 48. What To Avoid

Do not transform the design into:

### Generic SaaS dashboard

Avoid:

```text
huge KPI cards
white backgrounds
marketing illustrations
large gradients
```

### Generic IDE clone

Do not reproduce:

```text
VS Code
Visual Studio
JetBrains
```

The goal is to use the **structural advantages** of professional IDE interfaces without copying their visual identity.

### Generic graph visualization

Avoid:

```text
plain white canvas
bright colorful circles
large labels
random neon connections
```

The graph must feel integrated into an engineering workspace.

---

# 49. Design Rule

When adding a new feature, ask:

> Does this help the user understand, manipulate or analyze the graph?

If the answer is no, the feature should not visually compete with the workspace.

---

# 50. Final Design Formula

The GraphForge visual language can be summarized as:

```text
Dark Engineering UI
        +
IDE-like Workspace
        +
Graph Visualization
        +
Technical Data Panels
        +
Dense Information Architecture
        +
Subtle Purple Accent
        +
Minimal Motion
        =
Professional Graph Engineering Tool
```

The objective is not to make the software look "cool".

The objective is to make it look **credible**.

A user should be able to see the interface and immediately believe:

> "This is a serious technical application used to work with complex systems."

---

# 51. Reusing This Design For Other Software

When adapting this design to another product, preserve:

```text
Top bar
Activity navigation
Explorer
Main workspace
Inspector
Bottom utility panel
Status bar
Dark token system
Compact typography
Subtle borders
Strong selected states
```

Change:

```text
Graph content
Node types
Inspector properties
Metrics
Explorer structure
Toolbar actions
Domain terminology
```

This allows the design system to become a **general-purpose professional desktop application framework** rather than a GraphForge-specific UI.

---

# 52. Recommended Technology Stack

For a real implementation:

```text
React
TypeScript
Vite
Tailwind CSS
```

Graph rendering:

```text
Cytoscape.js
```

Alternative:

```text
React Flow
D3.js
Sigma.js
```

State:

```text
Zustand
```

Icons:

```text
Lucide React
```

Data:

```text
REST API
GraphQL
WebSocket
Local JSON
SQLite
PostgreSQL
```

The architecture should keep the graph rendering layer independent from the rest of the interface.

---

# 53. Implementation Priority

If building the actual product, implement in this order:

```text
01. Application shell
02. Top bar
03. Activity bar
04. Explorer
05. Tabs
06. Graph canvas
07. Node selection
08. Inspector
09. Graph toolbar
10. Bottom panel
11. Status bar
12. Minimap
13. Context menus
14. Keyboard shortcuts
15. Advanced graph analysis
```

The first milestone should already look like a complete professional application.

---

# 54. Portfolio Presentation

For portfolio presentation, use the following sequence:

### Shot 01 — Workspace

Full application screenshot.

### Shot 02 — Graph Focus

Zoom into the central graph.

### Shot 03 — Inspector

Select a node and show its properties.

### Shot 04 — Analysis

Show terminal/output and graph statistics.

### Shot 05 — Architecture

Show a different graph layout.

This creates the perception of a complete product rather than a single static UI mockup.

---

# 55. Final Principle

GraphForge should look like software that **already exists**.

Not:

> "Here is a beautiful UI concept."

But:

> "Here is a professional engineering tool that happens to have an exceptionally polished interface."

That distinction is fundamental to the design.