import { affectedContexts } from './affected-contexts';
import type { CoverageLayer } from './coverage-layer';

/** The files a run measures: the given layers of every context, or of the contexts a partial run names; the files no spec loads are included. */
export function measuredFiles(contextsDir: string, layers: readonly CoverageLayer[]): string[] {
  const contexts = affectedContexts() ?? ['*'];

  return contexts.flatMap((context) => layers.map((layer) => `${contextsDir}/${context}/${layer}/**/*.ts`));
}
