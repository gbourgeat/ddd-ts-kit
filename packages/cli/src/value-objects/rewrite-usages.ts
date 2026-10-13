import { refusalAssertions } from './refusal-assertions.js';
import type { ResultMethods } from './result-methods.js';
import type { Rewrite } from './rewrite.js';
import { tidyImports } from './tidy-imports.js';
import { withoutUnwrap } from './without-unwrap.js';

/** How many places of each kind a source had rewritten. */
export interface UsageCounts {
  readonly unwraps: number;
  readonly assertions: number;
}

/** A source once its calls of the changed factories read the value directly: no `unwrap`, assertions on the factory. */
export function rewriteUsages(source: string, methods: ResultMethods): Rewrite & UsageCounts {
  let unwrapped: Rewrite = { source, count: 0 };
  let unwraps = 0;

  do {
    unwrapped = withoutUnwrap(unwrapped.source, methods);
    unwraps += unwrapped.count;
  } while (unwrapped.count > 0);

  const asserted = refusalAssertions(unwrapped.source, methods);

  return {
    source: tidyImports(asserted.source),
    count: unwraps + asserted.count,
    unwraps,
    assertions: asserted.count,
  };
}
