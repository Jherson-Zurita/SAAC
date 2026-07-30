import type { ArchitectureModelGraph, FitnessEvaluationResult } from '../../shared/types';

const AMG_CACHE_PREFIX = 'saac_cached_amg_';
const FITNESS_CACHE_PREFIX = 'saac_cached_fitness_';

function sanitizeKey(path: string): string {
  return path.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function saveCachedProjectData(
  path: string,
  amg: ArchitectureModelGraph,
  fitnessResult?: FitnessEvaluationResult | null
) {
  try {
    const key = sanitizeKey(path);
    localStorage.setItem(`${AMG_CACHE_PREFIX}${key}`, JSON.stringify(amg));
    if (fitnessResult) {
      localStorage.setItem(`${FITNESS_CACHE_PREFIX}${key}`, JSON.stringify(fitnessResult));
    }
  } catch (err) {
    console.warn('Error al guardar caché de proyecto en localStorage:', err);
  }
}

export function loadCachedProjectData(path: string): {
  amg: ArchitectureModelGraph | null;
  fitnessResult: FitnessEvaluationResult | null;
} {
  try {
    const key = sanitizeKey(path);
    const rawAmg = localStorage.getItem(`${AMG_CACHE_PREFIX}${key}`);
    const rawFitness = localStorage.getItem(`${FITNESS_CACHE_PREFIX}${key}`);

    const amg = rawAmg ? (JSON.parse(rawAmg) as ArchitectureModelGraph) : null;
    const fitnessResult = rawFitness
      ? (JSON.parse(rawFitness) as FitnessEvaluationResult)
      : null;

    return { amg, fitnessResult };
  } catch (err) {
    console.warn('Error al cargar caché de proyecto desde localStorage:', err);
    return { amg: null, fitnessResult: null };
  }
}

export function clearCachedProjectData(path: string) {
  try {
    const key = sanitizeKey(path);
    localStorage.removeItem(`${AMG_CACHE_PREFIX}${key}`);
    localStorage.removeItem(`${FITNESS_CACHE_PREFIX}${key}`);
  } catch (err) {
    console.warn('Error al limpiar caché de proyecto:', err);
  }
}
