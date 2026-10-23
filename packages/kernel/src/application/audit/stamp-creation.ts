import type { Clock } from '../ports/clock';
import type { ExecutionScope } from '../ports/execution-scope';
import type { AuditStamp } from './audit-stamp';

/** For a repository adapter inserting a row: the current actor and instant, as both stamps. */
export function stampCreation(scope: ExecutionScope, clock: Clock): AuditStamp {
  const by = scope.require().actor.id;
  const at = clock.now();

  return { createdAt: at, createdBy: by, updatedAt: at, updatedBy: by };
}
