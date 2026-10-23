import { affectedContexts } from './affected-contexts';
import type { CoverageLayer } from './coverage-layer';

/**
 * The files a run measures: the given layers of every context, or of the contexts a partial run
 * names, the layers of the modules of their model included (`<context>/<module>/<layer>/`); the
 * files no spec loads are included.
 */
export function measuredFiles(contextsDir: string, layers: readonly CoverageLayer[]): string[] {
  const contexts = affectedContexts() ?? ['*'];

  return contexts.flatMap((context) =>
    layers.flatMap((layer) => [`${contextsDir}/${context}/${layer}/**/*.ts`, `${contextsDir}/${context}/*/${layer}/**/*.ts`]),
  );
}
