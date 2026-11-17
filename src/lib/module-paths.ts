/**
 * Los ids de módulo del AMG son rutas absolutas sin extensión
 * (`D:/proyectos/app/src/App`). Para mostrarlos se recortan al proyecto.
 */

const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
const isAbsolute = (p: string) => p.startsWith('/') || /^[A-Za-z]:\//.test(p);

/** Carpeta común a todos los ids (sin incluir el nombre de archivo). */
function commonDirectory(ids: string[]): string {
  if (!ids.length) return '';
  let prefix = ids[0].split('/').slice(0, -1);
  for (const id of ids.slice(1)) {
    const parts = id.split('/');
    let i = 0;
    while (i < prefix.length && i < parts.length - 1 && prefix[i].toLowerCase() === parts[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
    if (!prefix.length) break;
  }
  return prefix.join('/');
}

/**
 * Devuelve una función que convierte un id de módulo en su ruta relativa al proyecto.
 * Si `projectPath` no contiene a los módulos (proyecto movido, caché antigua),
 * recorta la carpeta común de los ids absolutos.
 */
export function createModulePathResolver(
  moduleIds: string[],
  projectPath: string | null | undefined
): (id: string) => string {
  const ids = moduleIds.map(normalize);
  const root = projectPath ? normalize(projectPath) : '';
  const rootLower = root.toLowerCase();

  const underRoot = (id: string) => rootLower !== '' && id.toLowerCase().startsWith(`${rootLower}/`);
  const absoluteIds = ids.filter(isAbsolute);

  let base = '';
  if (root && ids.some(underRoot)) base = root;
  else if (absoluteIds.length) base = commonDirectory(absoluteIds);
  const baseLower = base.toLowerCase();

  return (id: string) => {
    const normalized = normalize(id);
    if (baseLower && normalized.toLowerCase().startsWith(`${baseLower}/`)) {
      return normalized.slice(base.length + 1);
    }
    return normalized;
  };
}
