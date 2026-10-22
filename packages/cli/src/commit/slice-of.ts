import type { Config } from '../config';

/** The slice a changed file belongs to: a use case of a context (its folder, its route and their specs travel together), a layer of it, or a part of the project. */
export function sliceOf(config: Config, file: string): string {
  if (!file.startsWith(`${config.contextsDir}/`)) {
    return outside(config, file);
  }

  const [context = '', ...inside] = file.slice(config.contextsDir.length + 1).split('/');

  return `${context}: ${useCaseOf(inside) ?? /\/([^/.]+)\.(?:route|handler\.spec|route\.spec)\.ts$/.exec(file)?.[1] ?? layerOf(inside)}`;
}

/** The folder of a command or of a query. */
function useCaseOf([layer, kind, useCase]: readonly string[]): string | undefined {
  return layer === 'application' && (kind === 'commands' || kind === 'queries') ? useCase : undefined;
}

function layerOf([layer, kind]: readonly string[]): string {
  return layer === undefined || kind === undefined ? 'context files' : layer;
}

function outside(config: Config, file: string): string {
  if (file.startsWith(`${config.platformDir}/`)) {
    return 'platform';
  }

  return file.includes('/') ? (file.split('/')[0] ?? '') : 'project root';
}
