import fs from 'node:fs';
import path from 'node:path';
import type { CoverageLayer } from './coverage-layer';
import { isTypeOnlyFile } from './is-type-only-file';
import type { HeldLayer } from './held-layer';
import { layerFolders } from './layer-folders';

const SOURCE = /(?<!\.d)\.[cm]?ts$/;
const SPEC = /\.(?:spec|test)\.[cm]?ts$/;

/**
 * The layers a threshold applies to, among `layers`: one per context, and per module of its model,
 * that has a source file in it. An empty layer (a context with no route yet, a project just initialised) is held to nothing,
 * and is held to its threshold from its first source file. A partial run (`DDD_TS_KIT_AFFECTED`)
 * holds the contexts it names, each to its whole threshold, since it runs every spec of each;
 * the others are measured by the run of everything.
 */
export function heldLayers(root: string, contextsDir: string, layers: readonly CoverageLayer[]): HeldLayer[] {
  return layerFolders(root, contextsDir, layers).filter(({ directory }) => holdsASource(path.join(root, directory)));
}

function holdsASource(directory: string): boolean {
  if (!fs.existsSync(directory)) {
    return false;
  }

  return fs
    .readdirSync(directory, { withFileTypes: true, recursive: true })
    .some(
      (entry) =>
        entry.isFile() &&
        SOURCE.test(entry.name) &&
        !SPEC.test(entry.name) &&
        !isPort(entry) &&
        !isTypeOnlyFile(path.join(entry.parentPath, entry.name)),
    );
}

/** A port is not measured (`portFiles`), nor a file of types only: a layer that holds nothing else is held to nothing. */
function isPort(entry: fs.Dirent): boolean {
  const folder = entry.parentPath.split(path.sep).join('/');

  return (
    (folder.endsWith('/domain/repositories') && entry.name.endsWith('.repository.ts')) ||
    (folder.endsWith('/application/ports') && entry.name.endsWith('.port.ts'))
  );
}
