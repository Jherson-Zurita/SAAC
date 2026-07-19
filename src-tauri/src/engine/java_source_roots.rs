//! engine/java_source_roots.rs — Detecta las raíces de código fuente Java
//! de un proyecto (`src/main/java`, `src/test/java`, o rutas custom
//! declaradas en `pom.xml` / `build.gradle*`), necesarias para resolver
//! imports de paquetes Java (`com.example.Foo`) contra los `module_id`
//! (rutas de archivo) que produce `parsers/java.py`.
//!
//! ## Por qué esto es necesario
//!
//! `module_id` es la ruta de archivo completa (ej.
//! `myproject/src/main/java/com/example/service/UserRepository`), pero un
//! import Java (`dep.target`) es el paquete con notación de puntos
//! (`com.example.service.UserRepository`). Para poder comparar ambos hace
//! falta saber DÓNDE dentro de la ruta de archivo empieza la jerarquía de
//! paquetes — ese punto de corte es la "raíz de fuentes". En el 95% de los
//! proyectos Maven/Gradle es `src/main/java/` (o `src/test/java/` para
//! tests), pero ambas herramientas permiten declarar rutas custom.
//!
//! ## Alcance y limitaciones (documentadas explícitamente)
//!
//! - **Maven (`pom.xml`)**: se parsea como XML real (vía `quick-xml`) y se
//!   leen `<build><sourceDirectory>` / `<testSourceDirectory>` si están
//!   presentes. Si el POM no los declara, Maven usa los defaults
//!   (`src/main/java`, `src/test/java`), que se devuelven igual.
//! - **Gradle (`build.gradle` / `build.gradle.kts`)**: Gradle usa un DSL
//!   de Groovy/Kotlin que NO es parseable de forma robusta sin embeber un
//!   intérprete completo de ese lenguaje. En su lugar, se hace una
//!   búsqueda de texto (regex simple) por el patrón común
//!   `srcDirs = [...]` / `srcDir "..."` dentro de bloques `sourceSets`.
//!   Esto cubre declaraciones literales simples; NO cubre rutas
//!   construidas dinámicamente (variables, condicionales, interpolación),
//!   que quedan fuera de alcance — en ese caso se cae al fallback.
//! - **Fallback universal**: si no hay `pom.xml` ni `build.gradle*` en la
//!   raíz del proyecto, o no se pudo extraer nada reconocible de ellos, se
//!   devuelven las convenciones estándar (`src/main/java`,
//!   `src/test/java`) sin más.
//! - La detección es a nivel de PROYECTO (una sola pasada sobre la raíz),
//!   no por módulo — proyectos multi-módulo Maven/Gradle con
//!   `sourceDirectory` distinto POR MÓDULO no están cubiertos; se toma la
//!   primera declaración encontrada como válida para todo el proyecto.

use std::fs;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::reader::Reader;

/// Raíces de fuentes Java estándar, usadas como fallback y siempre
/// incluidas además de cualquier ruta custom detectada (un proyecto puede
/// tener módulos con la convención estándar Y un módulo con override).
const DEFAULT_JAVA_SOURCE_ROOTS: &[&str] = &["src/main/java", "src/test/java"];

/// Detecta las raíces de fuentes Java de un proyecto inspeccionando
/// `pom.xml` y `build.gradle`/`build.gradle.kts` en la raíz del proyecto
/// (y, para Maven, en el primer nivel de subdirectorios, cubriendo el caso
/// común de un módulo Maven anidado en un monorepo simple).
///
/// Devuelve SIEMPRE al menos `DEFAULT_JAVA_SOURCE_ROOTS`, más cualquier
/// ruta adicional detectada. Las rutas devueltas son relativas a
/// `project_root`, con `/` como separador (nunca `\`), sin slash inicial
/// ni final, para poder compararse directamente contra fragmentos de
/// `module_id` (que ya usan `/` — ver `parsers/*.py`, todos hacen
/// `.replace("\\", "/")`).
pub fn detect_java_source_roots(project_root: &Path) -> Vec<String> {
    let mut roots: Vec<String> = Vec::new();

    if let Some(pom_path) = find_file(project_root, "pom.xml", 1) {
        if let Ok(content) = fs::read_to_string(&pom_path) {
            roots.extend(extract_maven_source_dirs(&content));
        }
    }

    for gradle_name in ["build.gradle", "build.gradle.kts"] {
        if let Some(gradle_path) = find_file(project_root, gradle_name, 1) {
            if let Ok(content) = fs::read_to_string(&gradle_path) {
                roots.extend(extract_gradle_source_dirs(&content));
            }
        }
    }

    for default_root in DEFAULT_JAVA_SOURCE_ROOTS {
        let normalized = default_root.to_string();
        if !roots.contains(&normalized) {
            roots.push(normalized);
        }
    }

    roots
}

/// Busca un archivo por nombre exacto empezando en `root`, descendiendo
/// hasta `max_depth` niveles (0 = solo la raíz misma). Devuelve la primera
/// coincidencia encontrada (orden de `read_dir`, no determinístico entre
/// sistemas de archivos — aceptable porque en la enorme mayoría de
/// proyectos hay un único `pom.xml`/`build.gradle` relevante en ese rango
/// de profundidad).
fn find_file(root: &Path, filename: &str, max_depth: usize) -> Option<std::path::PathBuf> {
    let direct = root.join(filename);
    if direct.is_file() {
        return Some(direct);
    }
    if max_depth == 0 {
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_file(&path, filename, max_depth - 1) {
                return Some(found);
            }
        }
    }
    None
}

/// Extrae `<sourceDirectory>` y `<testSourceDirectory>` de un `pom.xml`
/// parseado como XML real. Solo se leen las apariciones DIRECTAS bajo
/// `<project><build>` (no las de `<profile><build>` ni de módulos hijos
/// declarados inline), que es el caso estándar y ampliamente dominante.
///
/// Las rutas típicas en Maven ya usan `/` (`src/main/custom-java`), pero
/// se normalizan igual por robustez ante POMs generados en Windows.
fn extract_maven_source_dirs(xml_content: &str) -> Vec<String> {
    let mut reader = Reader::from_str(xml_content);
    reader.config_mut().trim_text(true);

    let mut roots = Vec::new();
    let mut tag_stack: Vec<String> = Vec::new();
    let mut capturing_tag: Option<&'static str> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                // Solo capturamos si estamos exactamente en project > build > (source|test)Directory,
                // para no confundir con homónimos dentro de <profile> o <pluginManagement>.
                if name == "sourceDirectory" && matches_path(&tag_stack, &["project", "build"]) {
                    capturing_tag = Some("main");
                } else if name == "testSourceDirectory" && matches_path(&tag_stack, &["project", "build"]) {
                    capturing_tag = Some("test");
                }
                tag_stack.push(name);
            }
            Ok(Event::Text(e)) => {
                if capturing_tag.is_some() {
                    if let Ok(text) = e.unescape() {
                        let normalized = text.trim().replace('\\', "/");
                        let normalized = normalized.trim_matches('/').to_string();
                        if !normalized.is_empty() {
                            roots.push(normalized);
                        }
                    }
                }
            }
            Ok(Event::End(_)) => {
                tag_stack.pop();
                capturing_tag = None;
            }
            Ok(Event::Eof) => break,
            Err(_) => break, // POM malformado: se ignora, cae al fallback en el llamador.
            _ => {}
        }
        buf.clear();
    }

    roots
}

/// Compara si `stack` termina exactamente con la secuencia `expected`
/// (ej. `stack = ["project", "build"]`, `expected = ["project", "build"]`
/// → true; útil para chequear "estamos justo dentro de este path", no en
/// un descendiente más profundo como `profile > build`).
fn matches_path(stack: &[String], expected: &[&str]) -> bool {
    if stack.len() != expected.len() {
        return false;
    }
    stack.iter().zip(expected.iter()).all(|(a, b)| a == b)
}

/// Extrae rutas de `srcDirs`/`srcDir` dentro de bloques `sourceSets` de un
/// `build.gradle`/`build.gradle.kts`, vía búsqueda de texto (NO un parser
/// real de Groovy/Kotlin — ver limitaciones en el docstring del módulo).
///
/// Reconoce los patrones literales más comunes, incluyendo listas
/// multilínea:
///   - `srcDirs = ['src/main/java', 'src/generated/java']`
///   - `srcDirs = [\n    'src/main/java',\n    'src/generated/java'\n]`
///   - `srcDir 'src/main/java'` / `srcDir "src/main/java"`
///
/// No reconoce rutas construidas con variables, `file(...)`,
/// concatenación, ni bloques condicionales — esos casos simplemente no
/// aportan nada aquí y el llamador cae al fallback estándar.
fn extract_gradle_source_dirs(content: &str) -> Vec<String> {
    let mut roots = Vec::new();

    let mut search_from = 0usize;
    while let Some(rel_idx) = content[search_from..].find("srcDir") {
        let start = search_from + rel_idx;
        let rest = &content[start..];

        // Ventana de búsqueda: hasta el próximo ')' o ']' (cierre real de
        // la lista/llamada), buscando en TODO el resto del archivo en vez
        // de detenerse en el primer salto de línea — así se soportan
        // listas multilínea. Si no hay cierre, se usa una ventana
        // acotada (200 chars) para no escanear el resto del archivo entero
        // en el caso patológico de un ')'/']' faltante.
        let end_idx = rest
            .find(|c| c == ')' || c == ']')
            .unwrap_or_else(|| rest.len().min(200));
        let segment = &rest[..end_idx];

        let mut in_quote: Option<char> = None;
        let mut current = String::new();
        for c in segment.chars() {
            match in_quote {
                Some(q) if c == q => {
                    if !current.is_empty() {
                        let normalized = current.replace('\\', "/");
                        let normalized = normalized.trim_matches('/').to_string();
                        if !normalized.is_empty() {
                            roots.push(normalized);
                        }
                    }
                    current.clear();
                    in_quote = None;
                }
                Some(_) => current.push(c),
                None if c == '\'' || c == '"' => in_quote = Some(c),
                None => {}
            }
        }

        search_from = start + "srcDir".len();
    }

    roots
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maven_default_when_no_pom() {
        let roots = extract_maven_source_dirs("");
        assert!(roots.is_empty());
    }

    #[test]
    fn maven_custom_source_directory() {
        let xml = r#"
            <project>
                <build>
                    <sourceDirectory>src/main/custom-java</sourceDirectory>
                    <testSourceDirectory>src/test/custom-java</testSourceDirectory>
                </build>
            </project>
        "#;
        let roots = extract_maven_source_dirs(xml);
        assert_eq!(roots, vec!["src/main/custom-java", "src/test/custom-java"]);
    }

    #[test]
    fn maven_ignores_profile_build() {
        // sourceDirectory dentro de <profile><build> NO debe capturarse,
        // solo el de <project><build> directo.
        let xml = r#"
            <project>
                <profiles>
                    <profile>
                        <build>
                            <sourceDirectory>src/profile-only/java</sourceDirectory>
                        </build>
                    </profile>
                </profiles>
                <build>
                    <sourceDirectory>src/main/java</sourceDirectory>
                </build>
            </project>
        "#;
        let roots = extract_maven_source_dirs(xml);
        assert_eq!(roots, vec!["src/main/java"]);
    }

    #[test]
    fn gradle_src_dirs_list() {
        let content = r#"
            sourceSets {
                main {
                    java {
                        srcDirs = ['src/main/java', 'src/generated/java']
                    }
                }
            }
        "#;
        let roots = extract_gradle_source_dirs(content);
        assert_eq!(roots, vec!["src/main/java", "src/generated/java"]);
    }

    #[test]
    fn gradle_src_dirs_multiline() {
        let content = "sourceSets {\n  main {\n    java {\n      srcDirs = [\n        'src/main/java',\n        'src/generated/java'\n      ]\n    }\n  }\n}";
        let roots = extract_gradle_source_dirs(content);
        assert_eq!(roots, vec!["src/main/java", "src/generated/java"]);
    }

    #[test]
    fn gradle_src_dir_single() {
        let content = r#"srcDir "src/main/java""#;
        let roots = extract_gradle_source_dirs(content);
        assert_eq!(roots, vec!["src/main/java"]);
    }

    #[test]
    fn detect_falls_back_to_defaults_without_project_files() {
        let tmp = std::env::temp_dir().join(format!("saac_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&tmp);
        let roots = detect_java_source_roots(&tmp);
        assert!(roots.contains(&"src/main/java".to_string()));
        assert!(roots.contains(&"src/test/java".to_string()));
        let _ = fs::remove_dir_all(&tmp);
    }
}