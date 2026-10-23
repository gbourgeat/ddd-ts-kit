import fs from 'node:fs';
import path from 'node:path';
import { affectedContexts } from './affected-contexts';
import { contextsIn } from './contexts-in';
import type { CoverageLayer } from './coverage-layer';

const SOURCE = /(?<!\.d)\.[cm]?ts$/;
const SPEC = /\.(?:spec|test)\.[cm]?ts$/;

/** A layer of one context that holds at least one source file: the unit a threshold is applied to. */
export interface HeldLayer {
  readonly context: string;
  readonly layer: CoverageLayer;
  /** Posix path of the layer directory from the root of the project. */
  readonly directory: string;
}

/**
 * The layers a threshold applies to, among `layers`: one per context that has a source file in
 * it. An empty layer (a context with no route yet, a project just initialised) is held to nothing,
 * and is held to its threshold from its first source file. A partial run (`DDD_TS_KIT_AFFECTED`)
 * holds the contexts it names, each to its whole threshold, since it runs every spec of each;
 * the others are measured by the run of everything.
 */
export function heldLayers(root: string, contextsDir: string, layers: readonly CoverageLayer[]): HeldLayer[] {
  const affected = affectedContexts();

  return contextsIn(path.join(root, contextsDir))
    .filter((context) => affected === undefined || affected.includes(context))
    .flatMap((context) =>
      layers
        .map((layer) => ({ context, layer, directory: `${contextsDir}/${context}/${layer}` }))
        .filter(({ directory }) => holdsASource(path.join(root, directory))),
    );
}

function holdsASource(directory: string): boolean {
  if (!fs.existsSync(directory)) {
    return false;
  }

  return fs
    .readdirSync(directory, { withFileTypes: true, recursive: true })
    .some((entry) => entry.isFile() && SOURCE.test(entry.name) && !SPEC.test(entry.name));
}
