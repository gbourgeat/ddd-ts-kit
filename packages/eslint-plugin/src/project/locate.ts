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

  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';
  const inModule = moduleLocation(config, { context, layer, rest });

  if (inModule !== undefined) {
    return inModule;
  }

  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

interface Placed {
  readonly context: string;
  readonly layer: Layer;
  /** The path below the layer. */
  readonly rest: readonly string[];
}

/**
 * A module of the model is one folder level under domain/ and application/: left out, the rest of
 * the path is what it would be without modules, so every role keeps its place.
 */
function moduleLocation(config: Config, { context, layer, rest }: Placed): Location | undefined {
  const [module, ...below] = rest;

  if (!(layer === 'domain' || layer === 'application') || module === undefined || below.length === 0) {
    return undefined;
  }

  return config.contexts[context]?.modules.includes(module) === true
    ? { area: 'context', context, layer, inside: below, module }
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
