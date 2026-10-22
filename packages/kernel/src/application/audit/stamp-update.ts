import type { Clock } from '../ports/clock';
import type { ExecutionScope } from '../ports/execution-scope';
import type { AuditStamp } from './audit-stamp';
import type { UpdateStamp } from './update-stamp';

/**
 * For a repository adapter updating a row. Given the stored stamp, answers it whole with the
 * creation part kept as it is; given none, answers the two columns to set.
 */
export function stampUpdate(scope: ExecutionScope, clock: Clock): UpdateStamp;
export function stampUpdate(stamp: AuditStamp, scope: ExecutionScope, clock: Clock): AuditStamp;

export function stampUpdate(
  ...args: [ExecutionScope, Clock] | [AuditStamp, ExecutionScope, Clock]
): UpdateStamp | AuditStamp {
  if (args.length === 2) {
    return updateStamp(...args);
  }

  const [stamp, scope, clock] = args;

  return { ...stamp, ...updateStamp(scope, clock) };
}

function updateStamp(scope: ExecutionScope, clock: Clock): UpdateStamp {
  return { updatedAt: clock.now(), updatedBy: scope.require().actor.id };
}
