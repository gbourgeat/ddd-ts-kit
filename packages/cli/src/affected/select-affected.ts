import type { Config } from '../config';
import { downstreamsOf } from './downstreams-of';
import { everything } from './everything';
import type { PathReach } from './path-reach';
import { reachOf } from './reach-of';
import type { Selection } from './selection';

/**
 * What a change set has to run. A context whose sources changed is selected with every context
 * downstream of it; a context whose tests alone changed is selected alone (no other context may
 * import them); one path that is shared, or that nobody listed, selects everything. The
 * selection is never narrower than the declared dependencies: `context/declared-relationship`
 * keeps the imports inside them, and that rule runs on the whole project in every pipeline.
 */
export function selectAffected(config: Config, changed: readonly string[]): Selection {
  const reaches = changed.map((file) => reachOf(config, file));
  const shared = reaches.find((reach) => reach.kind === 'everything');

  if (shared !== undefined) {
    return everything(config, shared.reason);
  }

  const selected = new Set(reaches.flatMap((reach) => contextsOf(config, reach)));
  const declared = Object.keys(config.contexts);
  const contexts = declared.filter((context) => selected.has(context));

  if (contexts.length === 0) {
    const reason = changed.length === 0 ? 'no file changed' : 'only documents changed';

    return { scope: 'none', reason, contexts: [], specs: [], leftOut: [] };
  }

  const directory = (context: string): string => `${config.contextsDir}/${context}/`;

  return {
    scope: contexts.length === declared.length ? 'all' : 'contexts',
    reason: 'the changed contexts and the contexts downstream of them in the context map',
    contexts,
    specs: [...contexts.map((context) => `${directory(context)}**/*.spec.ts`), `!${config.contextsDir}/**`],
    leftOut: declared.filter((context) => !selected.has(context)).map(directory),
  };
}

function contextsOf(config: Config, reach: PathReach): string[] {
  if (reach.kind !== 'context') {
    return [];
  }

  return reach.testsOnly ? [reach.context] : [reach.context, ...downstreamsOf(config, reach.context)];
}
