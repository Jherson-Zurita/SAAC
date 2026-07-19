//! project_detector.rs — Detección de tipo de proyecto y lenguajes dominantes.
//!
//! Ítem 2 del plan "Motor Backend Core": inspecciona el filesystem del
//! proyecto para inferir su `ProjectType` (web/server/mobile/desktop) y la
//! lista de `Language` presentes, ordenada por cantidad de archivos
//! (dominante primero).
//!
//! ## Estrategia de detección de ProjectType
//!
//! 1. Busca archivos marcadores de ecosistema (`package.json`,
//!    `requirements.txt`/`pyproject.toml`/`Pipfile`, `Cargo.toml`,
//!    `go.mod`, `pom.xml`/`build.gradle*`) primero en la raíz del
//!    proyecto y, si no aparecen ahí, en una búsqueda acotada (profundidad
//!    máxima `MARKER_SEARCH_MAX_DEPTH`, saltando directorios pesados como
//!    `node_modules`/`target`/`.venv`/`.git`) — necesario porque proyectos
//!    reales como el propio SAAC tienen su `Cargo.toml` en `src-tauri/`,
//!    no en la raíz.
//! 2. Señales fuertes e inequívocas (Tauri, Electron, React Native/Expo,
//!    plugin Android de Gradle) se evalúan ANTES que las genéricas de
//!    framework backend, porque un proyecto puede tener package.json +
//!    Cargo.toml + requirements.txt simultáneamente (monorepo) y el shell
//!    desktop/mobile normalmente "envuelve" a los demás.
//! 3. Si ninguna señal fuerte aparece, se cuenta evidencia de framework
//!    backend (Express/Flask/Spring Boot/axum/etc.) vs frontend puro para
//!    decidir entre `server` y `web`.
//! 4. Sin ninguna señal reconocible, cae a `server` (caso más común para
//!    un proyecto de código sin marcadores de UI).
//!
//! Esta heurística es deliberadamente simple (un solo pase, conteo de
//! substrings sobre el contenido de los archivos marcadores, sin parsear
//! JSON/TOML de verdad ni scoring ponderado configurable) — suficiente
//! para el uso previsto (mostrar un tipo de proyecto aproximado en la UI),
//! no un clasificador exhaustivo. Parsear `package.json` como JSON real en
//! vez de buscar substrings evitaría falsos positivos por dependencias
//! nombradas en comentarios o strings no relacionados — mejora futura
//! razonable si la heurística actual da problemas en la práctica.

use ignore::WalkBuilder;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

use crate::engine::amg::{Language, ProjectType};

const MARKER_SEARCH_MAX_DEPTH: usize = 4;

const EXCLUDED_DIR_SEGMENTS: &[&str] = &[
    "/node_modules/", "/target/", "/.venv/", "/.git/", "/dist/", "/build/",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetectionResult {
    pub detected_type: ProjectType,
    /// Lenguajes encontrados, ordenados de más a menos dominante por
    /// cantidad de archivos. Corresponde a `Project.detectedLanguages` en
    /// `shared/types.ts` (no a un campo del AMG).
    pub languages: Vec<Language>,
}

pub struct ProjectDetector;

impl ProjectDetector {
    /// Punto de entrada principal: detecta tipo de proyecto y lenguajes
    /// dominantes a partir de la ruta raíz del proyecto.
    pub fn detect(root_path: &str) -> ProjectDetectionResult {
        let markers = Self::find_markers(root_path);
        let detected_type = Self::infer_project_type(&markers);
        let languages = Self::detect_languages(root_path);

        ProjectDetectionResult {
            detected_type,
            languages,
        }
    }

    // ── Búsqueda de archivos marcadores ──

    fn find_markers(root_path: &str) -> Markers {
        let mut markers = Markers::default();

        // Primero, comprobación directa en la raíz (caso común, evita el
        // costo de un walk completo para el caso feliz).
        Self::inspect_dir(root_path, &mut markers);
        if markers.found_any() {
            return markers;
        }

        // Si no hay nada en la raíz, walk acotado por profundidad buscando
        // los mismos marcadores en subdirectorios (ej. src-tauri/Cargo.toml).
        let walker = WalkBuilder::new(root_path)
            .max_depth(Some(MARKER_SEARCH_MAX_DEPTH))
            .build();

        for result in walker {
            let Ok(entry) = result else { continue };
            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                continue;
            }
            let dir_str = entry.path().to_string_lossy().replace('\\', "/");
            if EXCLUDED_DIR_SEGMENTS.iter().any(|seg| dir_str.contains(seg)) {
                continue;
            }
            let dir_owned = entry.path().to_string_lossy().into_owned();
            Self::inspect_dir(&dir_owned, &mut markers);
        }

        markers
    }

    fn inspect_dir(dir_path: &str, markers: &mut Markers) {
        let dir = Path::new(dir_path);

        if let Some(content) = read_to_string_opt(&dir.join("package.json")) {
            markers.package_json = Some(content);
        }
        if dir.join("requirements.txt").exists() {
            markers.python_project = true;
            if let Some(content) = read_to_string_opt(&dir.join("requirements.txt")) {
                markers.python_deps.push_str(&content);
                markers.python_deps.push('\n');
            }
        }
        if let Some(content) = read_to_string_opt(&dir.join("pyproject.toml")) {
            markers.python_project = true;
            markers.python_deps.push_str(&content);
            markers.python_deps.push('\n');
        }
        if dir.join("Pipfile").exists() {
            markers.python_project = true;
        }
        if let Some(content) = read_to_string_opt(&dir.join("Cargo.toml")) {
            markers.cargo_toml = Some(content);
        }
        if dir.join("go.mod").exists() {
            markers.go_project = true;
        }
        if let Some(content) = read_to_string_opt(&dir.join("pom.xml")) {
            markers.java_deps.push_str(&content);
            markers.java_deps.push('\n');
        }
        if let Some(content) = read_to_string_opt(&dir.join("build.gradle")) {
            markers.java_deps.push_str(&content);
            markers.java_deps.push('\n');
        }
        if let Some(content) = read_to_string_opt(&dir.join("build.gradle.kts")) {
            markers.java_deps.push_str(&content);
            markers.java_deps.push('\n');
        }
    }

    // ── Inferencia de ProjectType a partir de los marcadores encontrados ──

    fn infer_project_type(markers: &Markers) -> ProjectType {
        // 1. Señales fuertes e inequívocas de shell desktop/mobile — se
        // evalúan primero porque "envuelven" a los demás ecosistemas en
        // un monorepo (ej. SAAC mismo: package.json + Cargo.toml + Tauri).
        if let Some(pkg) = &markers.package_json {
            if contains_any(pkg, &["\"@tauri-apps/", "\"electron\""]) {
                return ProjectType::Desktop;
            }
            if contains_any(pkg, &["\"react-native\"", "\"expo\""]) {
                return ProjectType::Mobile;
            }
        }
        if let Some(cargo) = &markers.cargo_toml {
            if contains_any(cargo, &["tauri = ", "tauri="]) {
                return ProjectType::Desktop;
            }
        }
        if contains_any(&markers.java_deps, &["com.android.application", "com.android.library"]) {
            return ProjectType::Mobile;
        }

        // 2. Evidencia de framework backend vs frontend puro.
        let mut server_signals = 0u32;
        let mut web_signals = 0u32;

        if let Some(pkg) = &markers.package_json {
            if contains_any(pkg, &["\"express\"", "\"fastify\"", "\"koa\"", "\"@nestjs/core\"", "\"hapi\""]) {
                server_signals += 1;
            }
            if contains_any(pkg, &["\"react\"", "\"vue\"", "\"next\"", "\"@angular/core\"", "\"svelte\""]) {
                web_signals += 1;
            }
        }
        if markers.python_project
            && contains_any(&markers.python_deps, &["flask", "django", "fastapi", "starlette"])
        {
            server_signals += 1;
        }
        if let Some(cargo) = &markers.cargo_toml {
            if contains_any(cargo, &["axum", "actix-web", "rocket", "warp", "tonic"]) {
                server_signals += 1;
            }
        }
        if markers.go_project {
            // Go casi siempre es backend/CLI en la práctica — sin señal
            // más específica, cuenta directo como server.
            server_signals += 1;
        }
        if contains_any(&markers.java_deps, &["spring-boot", "springframework"]) {
            server_signals += 1;
        }

        if server_signals > web_signals {
            return ProjectType::Server;
        }
        if web_signals > 0 {
            return ProjectType::Web;
        }

        // 3. Fallbacks débiles: presencia desnuda de un ecosistema sin
        // framework identificado dentro de su archivo de manifiesto.
        if markers.package_json.is_some() {
            return ProjectType::Web;
        }
        if markers.python_project
            || markers.cargo_toml.is_some()
            || markers.go_project
            || !markers.java_deps.is_empty()
        {
            return ProjectType::Server;
        }

        // 4. Sin ningún marcador reconocible.
        ProjectType::Server
    }

    // ── Conteo de lenguajes por extensión de archivo ──

    fn detect_languages(root_path: &str) -> Vec<Language> {
        let mut counts: HashMap<Language, u32> = HashMap::new();
        let walker = WalkBuilder::new(root_path).build();

        for result in walker {
            let Ok(entry) = result else { continue };
            if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                continue;
            }
            let path_str = entry.path().to_string_lossy().replace('\\', "/");
            if EXCLUDED_DIR_SEGMENTS.iter().any(|seg| path_str.contains(seg)) {
                continue;
            }
            if let Some(lang) = language_from_extension(entry.path()) {
                *counts.entry(lang).or_insert(0) += 1;
            }
        }

        let mut ranked: Vec<(Language, u32)> = counts.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));
        ranked.into_iter().map(|(lang, _)| lang).collect()
    }
}

#[derive(Default)]
struct Markers {
    package_json: Option<String>,
    python_project: bool,
    python_deps: String,
    cargo_toml: Option<String>,
    go_project: bool,
    java_deps: String,
}

impl Markers {
    fn found_any(&self) -> bool {
        self.package_json.is_some()
            || self.python_project
            || self.cargo_toml.is_some()
            || self.go_project
            || !self.java_deps.is_empty()
    }
}

fn read_to_string_opt(path: &Path) -> Option<String> {
    std::fs::read_to_string(path).ok()
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| haystack.contains(n))
}

fn language_from_extension(path: &Path) -> Option<Language> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "ts" | "tsx" => Some(Language::Typescript),
        "js" | "jsx" | "mjs" | "cjs" => Some(Language::Javascript),
        "py" | "pyi" => Some(Language::Python),
        "java" => Some(Language::Java),
        "kt" | "kts" => Some(Language::Kotlin),
        "cs" => Some(Language::Csharp),
        "swift" => Some(Language::Swift),
        "go" => Some(Language::Go),
        "rs" => Some(Language::Rust),
        _ => None,
    }
}
