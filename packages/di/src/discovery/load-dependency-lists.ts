import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WiringError } from '../errors/wiring-error';

interface Loading {
  readonly extensions: readonly string[];
  readonly load: (file: URL) => Promise<unknown>;
}

/**
 * Loads `<context>.dependencies`, the generated file of a discovered context that registers
 * what each constructor receives (`ddd-ts-kit docs` writes it from the constructor signatures)
 * and names the modules of the model (`modulesNamedIn` reads those before any file is loaded),
 * under the preferred extension it exists with. A context whose classes take nothing, or list
 * their dependencies in their decorators, and that declares no module, has none: a class left
 * without a list is refused when the application is composed.
 */
export async function loadDependencyLists(root: string, context: string, loading: Loading): Promise<void> {
  const present = new Set(await readdir(root));

  const file = loading.extensions
    .map((extension) => `${context}.dependencies${extension}`)
    .find((candidate) => present.has(candidate));

  if (file === undefined) {
    return;
  }

  const absolute = path.join(root, file);

  try {
    await loading.load(pathToFileURL(absolute));
  } catch (error) {
    throw new WiringError(
      'DISCOVERY_FAILED',
      `${absolute} could not be loaded: ${error instanceof Error ? error.message : String(error)}. It is generated: run \`ddd-ts-kit docs\` to rewrite it.`,
      { cause: error },
    );
  }
}
