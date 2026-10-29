import type { Config } from '../config';
import type { ContextDescription } from '../describe/context-description';
import { describeContext } from '../describe/describe-context';
import type { Workspace } from '../workspace';
import type { ContextFacts } from './context-facts';

/** What `describe` says of each context on disk, read once for every document `docs` writes from it. */
export function describeOnDisk(ws: Workspace, config: Config, contexts: readonly ContextFacts[]): ContextDescription[] {
  return contexts.filter((context) => context.onDisk).map((context) => describeContext(ws, config, context));
}
