import path from 'node:path';
import { affectedContexts } from './affected-contexts';
import { contextsIn } from './contexts-in';
import type { CoverageLayer } from './coverage-layer';
import type { HeldLayer } from './held-layer';
import { modulesIn } from './modules-in';

/** Every layer folder of the contexts a run measures, per module too, whether it holds a source file or not. */
export function layerFolders(root: string, contextsDir: string, layers: readonly CoverageLayer[]): HeldLayer[] {
  const affected = affectedContexts();

  return contextsIn(path.join(root, contextsDir))
    .filter((context) => affected === undefined || affected.includes(context))
    .flatMap((context) => {
      const folders = ['', ...modulesIn(path.join(root, contextsDir, context)).map((module) => `${module}/`)];

      return folders.flatMap((folder) =>
        layers.map((layer) => ({ context, layer, directory: `${contextsDir}/${context}/${folder}${layer}` })),
      );
    });
}
