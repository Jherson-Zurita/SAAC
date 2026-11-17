# SAAC — Code Architecture Analysis System

*Sistema de Análisis de Arquitectura de Código*

SAAC is a desktop application that analyzes a codebase **locally** and reconstructs its real architecture: C4 diagrams (levels 1–4), cohesion and complexity metrics, and detection of architectural antipatterns. It parses source code into ASTs with Tree-sitter, so it works across languages without compiling or running your project.

> **Status:** early-stage research project, developed as an undergraduate thesis at Universidad San Francisco Xavier de Chuquisaca (USFX, Sucre, Bolivia). Feedback and contributions are welcome.

![SAAC main view](capturas/REEMPLAZAR-con-tu-captura.png)
<!-- REEMPLAZAR: usa el nombre real de una captura de la carpeta capturas/ (la mejor vista general). Agrega 1–2 más abajo si quieres. -->

## Why SAAC

As more code is written or modified by AI assistants, teams lose track of how their system is actually structured. Existing architecture-analysis tools generally require uploading your source code to a third-party service. SAAC keeps the analysis on your machine, and when AI is used to summarize results, it can run against a local model so the full codebase never has to leave your computer.

## Features

- **C4 diagram generation**, levels 1–4: context, container, component, and code.
- **Antipattern detection**: God Module, Circular Dependency (via Tarjan's strongly connected components), and Layer Violation.
- **Metrics**: complexity and cohesion, including LCOM4 computed over a dependency graph with NetworkX.
- **Multi-language AST parsing** with Tree-sitter (see below).
- **Optional AI summaries** through Ollama or any OpenAI-compatible endpoint (local or cloud), with a mock fallback when no model is configured. Local models such as Qwen 2.5 Coder are supported.
- **Cancellable analysis** and crash-tolerant language workers (JSON Lines protocol with crash detection and respawn).

## Supported languages

| | | |
|---|---|---|
| TypeScript | JavaScript | Python |
| Java | Kotlin | C# |
| Swift | Go | Rust |

## Tech stack

- **Backend:** Rust, Tauri v2, sled (embedded persistence)
- **Frontend:** React 18, TypeScript, Vite, Zustand
- **Parsing:** Tree-sitter
- **Workers:** Node.js and Python worker processes communicating over JSON Lines

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- The [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS
- Python 3 (used by the Python worker and graph metrics)
<!-- VERIFICAR: si Python necesita paquetes (por ejemplo networkx), agrega aquí el comando: pip install networkx -->
- *(Optional)* [Ollama](https://ollama.com/) for local AI summaries, e.g. `ollama pull qwen2.5-coder`

### Run in development

```bash
git clone https://github.com/Jherson-Zurita/SAAC.git
cd SAAC
npm install
npm run tauri dev
```
<!-- VERIFICAR: confirma en package.json que existe el script "tauri" (viene de la plantilla de Tauri). -->

### Build

```bash
npm run tauri build
```

## Usage

1. Launch SAAC and open the root folder of the project you want to analyze.
2. Run the analysis. Progress is shown while workers parse each file, and you can cancel at any time.
3. Explore the generated C4 diagrams, metrics, and detected antipatterns.
4. *(Optional)* Configure an AI endpoint to get natural-language summaries of the architecture.

A step-by-step walkthrough (in Spanish) is in [`anexo_manual_de_usuario.md`](anexo_manual_de_usuario.md).

## Documentation

Most project documentation is currently written in Spanish:

- [`SAAC_v2.0_Especificacion_Tecnica.md`](SAAC_v2.0_Especificacion_Tecnica.md): technical specification
- [`anexo_manual_de_usuario.md`](anexo_manual_de_usuario.md): user manual
- [`project_status.md`](project_status.md): current implementation status

## Project layout

```
src/          React + TypeScript frontend
src-tauri/    Rust backend (Tauri)
workers/      Language analysis workers
tests/        Tests
capturas/     Screenshots
```

## Contributing

Issues and pull requests are welcome, especially for parser coverage in the supported languages, additional antipattern detectors, and English documentation.

## License

Released under the [MIT License](LICENSE).

## Author

Elvis Jherson Zurita Paco ([@Jherson-Zurita](https://github.com/Jherson-Zurita))