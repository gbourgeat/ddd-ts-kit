import { unitOfWorkScope } from './unit-of-work-scope';

/**
 * Where the caller stands in a unit of work: `open` while its work runs, `before-commit` while
 * the domain events are dispatched inside the transaction, `after-commit` in a handler of that
 * phase, `outside` anywhere else, a save made outside of any unit of work included.
 */
export type UnitOfWorkStage = 'outside' | 'open' | 'before-commit' | 'after-commit';

export function unitOfWorkStage(): UnitOfWorkStage {
  const scope = unitOfWorkScope.getStore();

  if (scope === undefined || scope.kind === 'save' || scope.stage === 'closed') {
    return 'outside';
  }

  return scope.stage;
}
