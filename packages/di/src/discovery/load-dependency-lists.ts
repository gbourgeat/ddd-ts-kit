import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WiringError } from '../errors/wiring-error.js';

interface Loading {
  readonly extensions: readonly string[];
  readonly load: (file: URL) => Promise<unknown>;
}

/** What the generated `<context>.dependencies` file says of the context, besides the lists it registers. */
export interface DependencyLists {
  /** The modules of the model the context declares, in which its role files may sit. */
  readonly modules: readonly string[];
}

/**
 * Loads `<context>.dependencies`, the generated file of a discovered context that registers
 * what each constructor receives (`ddd-ts-kit docs` writes it from the constructor signatures)
 * and names the modules of the model the config declares, under the preferred extension it
 * exists with. A context whose classes take nothing, or list their dependencies in their
 * decorators, and that declares no module, has none: a class left without a list is refused when
 * the application is composed.
 */
export async function loadDependencyLists(root: string, context: string, loading: Loading): Promise<DependencyLists> {
  const present = new Set(await readdir(root));

  const file = loading.extensions
    .map((extension) => `${context}.dependencies${extension}`)
    .find((candidate) => present.has(candidate));

  if (file === undefined) {
    return { modules: [] };
  }

  const absolute = path.join(root, file);

  try {
    return { modules: modulesOf(await loading.load(pathToFileURL(absolute))) };
  } catch (error) {
    throw new WiringError(
      'DISCOVERY_FAILED',
      `${absolute} could not be loaded: ${error instanceof Error ? error.message : String(error)}. It is generated: run \`ddd-ts-kit docs\` to rewrite it.`,
      { cause: error },
    );
  }
}

/** The `modules` the file exports, when it exports a list of names. */
function modulesOf(namespace: unknown): string[] {
  const entries: [string, unknown][] =
    typeof namespace === 'object' && namespace !== null ? Object.entries(namespace) : [];

  const exported = entries.find(([key]) => key === 'modules')?.[1];

  return Array.isArray(exported) ? exported.filter((module): module is string => typeof module === 'string') : [];
}
