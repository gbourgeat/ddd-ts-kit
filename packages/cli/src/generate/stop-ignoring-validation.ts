import type { Config } from '../config/index.js';
import { validationDependencies } from '../init/validation-dependencies.js';
import type { Workspace } from '../workspace/index.js';
import { filesUnder } from './files-under.js';
import { editJson } from './kinds/extraction/edit-json.js';

const KNIP_FILE = 'knip.json';
const IGNORED = 'ignoreDependencies';

/**
 * `init` tells knip not to report the validation packages of a project that validates nothing
 * yet. Once a context imports the package, the note is removed: left there, knip would ask for
 * it, and the packages are reported again the day nothing uses them.
 */
export function stopIgnoringValidation(ws: Workspace, config: Config): void {
  const waiting = validationDependencies(config);
  const [validation = ''] = waiting;

  if (!ignored(ws).includes(validation) || !imports(ws, config, validation)) {
    return;
  }

  editJson(ws, KNIP_FILE, (knip) => {
    const kept = ignored(ws).filter((name) => !waiting.includes(name));

    // A key without a value is left out of the file.
    knip[IGNORED] = kept.length > 0 ? kept : undefined;
  });
}

function ignored(ws: Workspace): string[] {
  const text = ws.read(KNIP_FILE);
  const knip: unknown = text === undefined ? {} : JSON.parse(text);
  const names: unknown = typeof knip === 'object' && knip !== null ? Reflect.get(knip, IGNORED) : undefined;

  return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [];
}

/** The package itself or one of its entries (`@ddd-ts-kit/validation/zod`). */
function imports(ws: Workspace, config: Config, name: string): boolean {
  const reads = (text: string): boolean => text.includes(`from '${name}'`) || text.includes(`from '${name}/`);

  return filesUnder(ws, config.contextsDir)
    .filter((file) => file.endsWith('.ts'))
    .some((file) => reads(ws.read(`${config.contextsDir}/${file}`) ?? ''));
}
