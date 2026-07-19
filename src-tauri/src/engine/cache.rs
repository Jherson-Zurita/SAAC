//! cache.rs — Gestor de caché persistente del análisis basado en sled.
//!
//! Ítem 4 del plan "Motor Backend Core": almacena en una base de datos local
//! (.saac/cache_db/) los hashes SHA256 y resultados de análisis parciales
//! de cada archivo (`WorkerAnalysisResult`), lo que permite saltarse por completo
//! las llamadas a los workers Node/Python para archivos no modificados.

use std::path::Path;
use sled::Db;
use serde::{Serialize, Deserialize};
use crate::engine::amg::{WorkerAnalysisResult, ArchitectureModelGraph};
use anyhow::Result;

pub struct CacheManager {
    db: Db,
}

impl CacheManager {
    /// Abre la base de datos de caché de sled para el proyecto en la ruta dada.
    /// Crea el subdirectorio `.saac/` si no existe.
    pub fn open(project_path: &str) -> Result<Self> {
        let db_path = Path::new(project_path).join(".saac").join("cache_db");
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let db = sled::open(db_path)?;
        Ok(Self { db })
    }

    /// Obtiene el resultado de análisis guardado para un archivo basándose en su hash.
    /// Si el hash no coincide con el guardado o la clave no existe, retorna `None`.
    pub fn get_file_analysis(&self, file_path: &str, file_hash: &str) -> Option<WorkerAnalysisResult> {
        let key = format!("file:{}", file_path);
        if let Ok(Some(bytes)) = self.db.get(&key) {
            if let Ok(record) = serde_json::from_slice::<FileCacheRecord>(&bytes) {
                if record.hash == file_hash {
                    return Some(record.result);
                }
            }
        }
        None
    }

    /// Guarda el resultado de análisis de un archivo indexado con su hash.
    pub fn set_file_analysis(&self, file_path: &str, file_hash: &str, result: &WorkerAnalysisResult) -> Result<()> {
        let key = format!("file:{}", file_path);
        let record = FileCacheRecord {
            hash: file_hash.to_string(),
            result: result.clone(),
        };
        let bytes = serde_json::to_vec(&record)?;
        self.db.insert(key, bytes)?;
        Ok(())
    }

    /// Obtiene el último AMG completo guardado para el proyecto.
    pub fn get_latest_amg(&self) -> Option<ArchitectureModelGraph> {
        if let Ok(Some(bytes)) = self.db.get("amg:latest") {
            if let Ok(amg) = serde_json::from_slice::<ArchitectureModelGraph>(&bytes) {
                return Some(amg);
            }
        }
        None
    }

    /// Guarda el último AMG completo para el proyecto y hace flush a disco.
    pub fn set_latest_amg(&self, amg: &ArchitectureModelGraph) -> Result<()> {
        let bytes = serde_json::to_vec(amg)?;
        self.db.insert("amg:latest", bytes)?;
        self.db.flush()?;
        Ok(())
    }
}

/// Registro serializable para caché por archivo.
#[derive(Serialize, Deserialize)]
struct FileCacheRecord {
    hash: String,
    result: WorkerAnalysisResult,
}
