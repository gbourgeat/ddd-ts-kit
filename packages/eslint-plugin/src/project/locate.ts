import type { Config } from './config';
import type { Layer } from './layer';
import type { Location } from './location';

const LAYERS: readonly Layer[] = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'published-language',
  'test',
];

/** Same decision table as `locate` of the CLI: a file is classified by its path alone. */
export function locate(config: Config, file: string): Location {
  if (isUnder(file, config.contextsDir)) {
    return locateInContexts(config, file);
  }

  if (isUnder(file, config.sharedKernelDir)) {
    return { area: 'shared-kernel' };
  }

  if (isUnder(file, config.platformDir)) {
    return { area: 'platform' };
  }

  if (file === `${config.sourceRoot}/main.ts`) {
    return { area: 'main' };
  }

  return { area: 'other' };
}

function locateInContexts(config: Config, file: string): Location {
  const [context, first, ...rest] = file.slice(config.contextsDir.length + 1).split('/');

  if (context === undefined || context === '' || first === undefined) {
    return { area: 'other' };
  }

  if (rest.length === 0) {
    return locateAtContextRoot(context, first);
  }

  const inModule = moduleLocation(config.contexts[context]?.modules ?? [], context, [first, ...rest]);

  if (inModule !== undefined) {
    return inModule;
  }

  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';

  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

/** The layers a module holds, and the test folders of its specs, as `moduleSplit` of the CLI reads them. */
const MODULE_LAYERS: readonly Layer[] = ['domain', 'application', 'infrastructure', 'presentation'];
const MODULE_TEST_FOLDERS: readonly string[] = ['unit', 'integration'];

/**
 * A module of the model is one folder of the context holding its layers (`<module>/domain/...`),
 * one folder of the test folders of its specs (`test/unit/<module>/...`), or, as 0.86 laid it out,
 * one folder under domain/ and application/: left out, the rest of the path is what it would be
 * without modules, so every role keeps its place.
 */
function moduleLocation(modules: readonly string[], context: string, parts: readonly string[]): Location | undefined {
  const placed = inFolderOfModule(modules, parts) ?? inTestFolder(modules, parts) ?? inEarlierPlace(modules, parts);

  return placed === undefined ? undefined : { area: 'context', context, ...placed };
}

/** Where a file sits in its module: its layer, the path below it, the module. */
interface InModule {
  readonly layer: Layer;
  readonly inside: readonly string[];
  readonly module: string;
}

/** `<module>/<layer>/...`. */
function inFolderOfModule(
  modules: readonly string[],
  [first = '', second = '', ...rest]: readonly string[],
): InModule | undefined {
  const layer = MODULE_LAYERS.find((candidate) => candidate === second);

  return modules.includes(first) && layer !== undefined ? { layer, inside: rest, module: first } : undefined;
}

/** `test/<unit|integration>/<module>/...`. */
function inTestFolder(
  modules: readonly string[],
  [first, second = '', module = '', ...below]: readonly string[],
): InModule | undefined {
  return first === 'test' && MODULE_TEST_FOLDERS.includes(second) && modules.includes(module)
    ? { layer: 'test', inside: [second, ...below], module }
    : undefined;
}

/** `<domain|application>/<module>/...`, as 0.86 laid modules out. */
function inEarlierPlace(
  modules: readonly string[],
  [first = '', second = '', ...rest]: readonly string[],
): InModule | undefined {
  return (first === 'domain' || first === 'application') && modules.includes(second)
    ? { layer: first, inside: rest, module: second }
    : undefined;
}

/** A directory import (`../billing/published-language`) names the layer without a file. */
function locateAtContextRoot(context: string, entry: string): Location {
  if (entry === `${context}.module.ts`) {
    return { area: 'context', context, layer: 'module', inside: [] };
  }

  const placed = contextFileAt(context, entry.replace(/\.(?:js|ts)$/, ''));

  if (placed !== undefined) {
    return placed;
  }

  const named = LAYERS.find((candidate) => candidate === entry.replace(/\.ts$/, ''));

  return { area: 'context', context, layer: named ?? 'root', inside: [] };
}

/**
 * The code list and the permission set of a context sit at its root and are read as they were in
 * their role folder, as `locate` of the CLI reads them: `billing.codes.ts` is
 * `domain/errors/codes.ts`, `billing.permissions.ts` is `application/authorization/billing.permissions.ts`.
 * `stem` is the entry without its extension, as an import may name it.
 */
function contextFileAt(context: string, stem: string): Location | undefined {
  if (stem === `${context}.codes`) {
    return { area: 'context', context, layer: 'domain', inside: ['errors', 'codes.ts'] };
  }

  return stem === `${context}.permissions`
    ? { area: 'context', context, layer: 'application', inside: ['authorization', `${context}.permissions.ts`] }
    : undefined;
}

function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}
