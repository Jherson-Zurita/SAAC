/**
 * SAAC — Import Path Resolver
 * ============================
 *
 * Resuelve specifiers de import al ID estable del módulo dentro del proyecto.
 *
 * Estrategia:
 *   1. Imports de npm (no empiezan con . ni /) → null (no es módulo del proyecto)
 *   2. Paths relativos (./foo, ../bar) → normalizar a path desde raíz del proyecto
 *   3. Barrel exports (import from './dir') → dir/index
 *   4. Path aliases (@/...) → resolver según tsconfig (futuro)
 *
 * Referencia: §4.2.2 de la especificación técnica.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const INDEX_FILES = TS_EXTENSIONS.map((ext) => `index${ext}`);

/**
 * Resuelve un import specifier al ID estable del módulo.
 *
 * @param specifier - El string del import (ej: './services/auth', 'react', '../utils')
 * @param importerPath - Path absoluto del archivo que contiene el import
 * @returns El ID del módulo (path normalizado sin extensión) o null si es un paquete npm
 */
export function resolveImportPath(specifier: string, importerPath: string): string | null {
  // ── 1. Packages npm → no son módulos del proyecto ──
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    // Futuro: detectar path aliases de tsconfig (@/...)
    // Por ahora, si empieza con @/ lo tratamos como alias local
    if (specifier.startsWith('@/')) {
      // @/services/foo → src/services/foo (convención común)
      const aliasPath = specifier.replace(/^@\//, 'src/');
      return normalizeModuleId(aliasPath);
    }
    return null; // npm package
  }

  // ── 2. Paths relativos → resolver contra el directorio del importer ──
  const importerDir = path.dirname(importerPath);
  const resolved = path.resolve(importerDir, specifier);
  const normalizedResolved = resolved.replace(/\\/g, '/');

  // ── 3. Intentar resolver el archivo real ──
  // Caso: import exacto con extensión
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      return normalizeModuleId(normalizedResolved);
    }
    // Es un directorio → barrel export (index.ts)
    if (stat.isDirectory()) {
      for (const indexFile of INDEX_FILES) {
        const indexPath = path.join(resolved, indexFile);
        if (fs.existsSync(indexPath)) {
          return normalizeModuleId(path.join(normalizedResolved, 'index').replace(/\\/g, '/'));
        }
      }
      // Directorio sin index → devolver como está
      return normalizeModuleId(normalizedResolved);
    }
  }

  // Caso: sin extensión → probar extensiones
  for (const ext of TS_EXTENSIONS) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt)) {
      return normalizeModuleId(normalizedResolved);
    }
  }

  // Caso: directorio con barrel export
  for (const indexFile of INDEX_FILES) {
    const indexPath = path.join(resolved, indexFile);
    if (fs.existsSync(indexPath)) {
      return normalizeModuleId(path.join(normalizedResolved, 'index').replace(/\\/g, '/'));
    }
  }

  // No se pudo resolver → devolver el path normalizado de todas formas
  // (puede ser un módulo que aún no existe o un error en el código)
  return normalizeModuleId(normalizedResolved);
}

/**
 * Normaliza un path a un ID de módulo estable:
 * - Forward slashes
 * - Sin extensión .ts/.tsx/.js/.jsx
 * - Sin trailing /index si es un barrel export
 */
function normalizeModuleId(modulePath: string): string {
  let normalized = modulePath.replace(/\\/g, '/');

  // Quitar extensión
  for (const ext of TS_EXTENSIONS) {
    if (normalized.endsWith(ext)) {
      normalized = normalized.slice(0, -ext.length);
      break;
    }
  }

  return normalized;
}
