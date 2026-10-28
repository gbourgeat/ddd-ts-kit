import type { Name } from '../../naming';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { isEventSourced } from './is-event-sourced';
import { repositoryLine } from './repository-line';
import { repositoryPrefix } from './repository-prefix';

/**
 * The repository of an aggregate, created in the module file of a hand-wired context by the first
 * use case that needs it, and by none before: a constant no handler reads is dead code, which the
 * lint of the project refuses. A later use case finds it there and adds nothing, whatever module
 * file of the context holds it: its handler is registered in that file too (`repositoryLine`). The
 * other wiring families bind the repository to its port, where nothing is created before it is resolved.
 */
export function wireRepositoryOnFirstUse(scope: Scope, aggregate: Name): void {
  wire(
    scope,
    {
      kind: isEventSourced(scope, aggregate) ? 'repository/event-sourced-first-use' : 'repository/first-use',
      holding: repositoryLine(aggregate),
    },
    vars(scope, { aggregate: named(aggregate), adapter: repositoryPrefix(scope.config.stack.orm) }),
  );
}
