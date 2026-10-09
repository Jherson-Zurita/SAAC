//! secrets.rs — Credenciales en el almacén seguro del sistema operativo
//! (Administrador de credenciales de Windows, Keychain de macOS, Secret
//! Service en Linux).
//!
//! La API key del proveedor de IA vive aquí y no en el `localStorage` del
//! webview: el frontend puede guardarla o borrarla, pero nunca leerla.

use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "com.saac.app";
const AI_API_KEY_ACCOUNT: &str = "ai-api-key";

fn ai_key_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, AI_API_KEY_ACCOUNT)
        .map_err(|e| format!("No se pudo acceder al almacén de credenciales: {e}"))
}

/// API key guardada, o `None` si no hay ninguna (o el almacén no está disponible).
pub fn get_ai_api_key() -> Option<String> {
    let entry = ai_key_entry().ok()?;
    match entry.get_password() {
        Ok(key) if !key.is_empty() => Some(key),
        Ok(_) | Err(KeyringError::NoEntry) => None,
        Err(e) => {
            tracing::warn!("No se pudo leer la API key de IA del almacén seguro: {e}");
            None
        }
    }
}

pub fn set_ai_api_key(key: &str) -> Result<(), String> {
    ai_key_entry()?
        .set_password(key)
        .map_err(|e| format!("No se pudo guardar la API key en el almacén seguro: {e}"))
}

pub fn delete_ai_api_key() -> Result<(), String> {
    match ai_key_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(format!("No se pudo eliminar la API key del almacén seguro: {e}")),
    }
}
