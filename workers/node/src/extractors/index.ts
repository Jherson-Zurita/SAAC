/**
 * SAAC — Module Type Detector (Pattern Extractor)
 * ================================================
 *
 * Asigna un ModuleType a cada archivo analizado basándose en:
 *   1. Decoradores de framework (NestJS: @Controller, @Injectable, etc.)
 *   2. Patrones de React (componentes funcionales, hooks)
 *   3. Convenciones de nombrado (Repository, Service, Controller, etc.)
 *   4. Contenido del archivo (configuración, tests)
 *
 * Referencia: §4.2.2, §4.5 de la especificación técnica.
 */

import * as path from 'node:path';

// ── Tipos locales ──

type ModuleType =
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'util'
  | 'config'
  | 'middleware'
  | 'dto'
  | 'factory'
  | 'ui-component'
  | 'hook'
  | 'store'
  | 'test'
  | 'unknown';

interface ClassInfo {
  name: string;
  methods: { name: string }[];
  isInterface: boolean;
}

interface FunctionInfo {
  name: string;
  isExported: boolean;
}

// ── Patrones de detección ──

interface DetectionRule {
  type: ModuleType;
  /** Patrón de nombre de archivo (case-insensitive) */
  filePatterns?: RegExp[];
  /** Patrón de nombre de directorio padre */
  dirPatterns?: RegExp[];
  /** Patrón de nombre de clase */
  classPatterns?: RegExp[];
  /** Patrón de nombre de función */
  functionPatterns?: RegExp[];
  /** Patrón en imports del archivo */
  importPatterns?: RegExp[];
}

const DETECTION_RULES: DetectionRule[] = [
  // ── Tests (prioridad alta: evitar clasificar tests como otra cosa) ──
  {
    type: 'test',
    filePatterns: [
      /\.spec\.(ts|tsx|js|jsx)$/i,
      /\.test\.(ts|tsx|js|jsx)$/i,
      /\/__tests__\//i,
    ],
  },

  // ── NestJS decorators ──
  {
    type: 'controller',
    classPatterns: [/Controller$/],
    dirPatterns: [/controllers?$/i],
    filePatterns: [/\.controller\.(ts|js)$/i],
  },
  {
    type: 'service',
    classPatterns: [/Service$/],
    dirPatterns: [/services?$/i],
    filePatterns: [/\.service\.(ts|js)$/i],
  },
  {
    type: 'repository',
    classPatterns: [/Repository$/, /Repo$/],
    dirPatterns: [/repositor(y|ies)$/i, /repos?$/i, /dal$/i, /data$/i],
    filePatterns: [/\.repository\.(ts|js)$/i, /\.repo\.(ts|js)$/i],
  },
  {
    type: 'middleware',
    classPatterns: [/Middleware$/, /Guard$/, /Interceptor$/, /Filter$/, /Pipe$/],
    dirPatterns: [/middlewares?$/i, /guards?$/i, /interceptors?$/i],
    filePatterns: [/\.middleware\.(ts|js)$/i, /\.guard\.(ts|js)$/i],
  },
  {
    type: 'dto',
    classPatterns: [/Dto$/, /DTO$/, /Request$/, /Response$/, /Input$/, /Output$/],
    dirPatterns: [/dtos?$/i],
    filePatterns: [/\.dto\.(ts|js)$/i],
  },
  {
    type: 'model',
    classPatterns: [/Entity$/, /Model$/, /Schema$/],
    dirPatterns: [/models?$/i, /entities$/i, /schemas?$/i, /domain$/i],
    filePatterns: [/\.model\.(ts|js)$/i, /\.entity\.(ts|js)$/i],
  },
  {
    type: 'factory',
    classPatterns: [/Factory$/],
    dirPatterns: [/factories$/i],
    filePatterns: [/\.factory\.(ts|js)$/i],
  },

  // ── React patterns ──
  {
    type: 'hook',
    functionPatterns: [/^use[A-Z]/], // React hooks: useEffect, useState, useCustom
    dirPatterns: [/hooks?$/i],
  },
  {
    type: 'ui-component',
    dirPatterns: [/components?$/i, /views?$/i, /pages?$/i, /layouts?$/i, /screens?$/i],
    filePatterns: [/\.(tsx|jsx)$/],
  },
  {
    type: 'store',
    dirPatterns: [/stores?$/i, /state$/i, /redux$/i, /slices?$/i],
    filePatterns: [/\.store\.(ts|js)$/i, /\.slice\.(ts|js)$/i],
    functionPatterns: [/^create.*Store$/, /^use.*Store$/],
  },

  // ── Configuration & Utility ──
  {
    type: 'config',
    filePatterns: [
      /config\.(ts|js)$/i,
      /\.config\.(ts|js)$/i,
      /constants?\.(ts|js)$/i,
      /env\.(ts|js)$/i,
    ],
    dirPatterns: [/config$/i, /configs?$/i],
  },
  {
    type: 'util',
    dirPatterns: [/utils?$/i, /helpers?$/i, /lib$/i, /common$/i, /shared$/i],
    filePatterns: [/\.util\.(ts|js)$/i, /\.helper\.(ts|js)$/i],
  },
];

// ── Detector principal ──

/**
 * Detecta el tipo funcional de un módulo/archivo (§4.2.2).
 *
 * @param filePath - Path del archivo
 * @param classes - Clases extraídas del archivo
 * @param functions - Funciones extraídas del archivo
 * @param imports - IDs de módulos importados
 * @returns ModuleType inferido
 */
export function detectModuleType(
  filePath: string,
  classes: ClassInfo[],
  functions: FunctionInfo[],
  imports: string[]
): ModuleType {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = path.basename(normalizedPath);
  const dirName = path.dirname(normalizedPath);
  const parentDir = path.basename(dirName);

  for (const rule of DETECTION_RULES) {
    // Check file name patterns
    if (rule.filePatterns) {
      for (const pattern of rule.filePatterns) {
        if (pattern.test(normalizedPath) || pattern.test(fileName)) {
          return rule.type;
        }
      }
    }

    // Check directory patterns
    if (rule.dirPatterns) {
      for (const pattern of rule.dirPatterns) {
        if (pattern.test(parentDir) || pattern.test(dirName)) {
          return rule.type;
        }
      }
    }

    // Check class name patterns
    if (rule.classPatterns && classes.length > 0) {
      for (const cls of classes) {
        for (const pattern of rule.classPatterns) {
          if (pattern.test(cls.name)) {
            return rule.type;
          }
        }
      }
    }

    // Check function name patterns
    if (rule.functionPatterns && functions.length > 0) {
      for (const fn of functions) {
        for (const pattern of rule.functionPatterns) {
          if (pattern.test(fn.name)) {
            return rule.type;
          }
        }
      }
    }

    // Check import patterns
    if (rule.importPatterns) {
      for (const imp of imports) {
        for (const pattern of rule.importPatterns) {
          if (pattern.test(imp)) {
            return rule.type;
          }
        }
      }
    }
  }

  // ── Heurísticas adicionales ──

  // Si el archivo exporta un componente JSX (tiene .tsx y funciones exportadas),
  // es probable que sea un componente React
  if (normalizedPath.endsWith('.tsx') && functions.some((f) => f.isExported)) {
    return 'ui-component';
  }

  // Si solo tiene interfaces, es probablemente un modelo/tipo
  if (classes.length > 0 && classes.every((c) => c.isInterface)) {
    return 'model';
  }

  return 'unknown';
}
