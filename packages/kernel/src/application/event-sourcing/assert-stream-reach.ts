import type { ExecutionContext } from '../execution/execution-context';
import { assertNamesTenant } from '../tenancy/assert-names-tenant';
import { EventStreamTenantError } from './event-stream-tenant-error';

/** A stream that already holds events, and the tenant its first append recorded (none for a stream stored without one). */
export interface HeldStream {
  readonly stream: string;
  readonly recorded: string | undefined;
}

/**
 * What an event store given the execution scope checks before it hands out or extends a stream
 * that already holds events: work that names no tenant is refused (`assertNamesTenant`), and a
 * stream of another tenant too. An elevation (`acrossTenants`) widens a read to its tenants, never
 * a write.
 */
export function assertStreamReach(
  context: ExecutionContext | undefined,
  held: HeldStream,
  access: 'read' | 'write',
): void {
  assertNamesTenant(context, access);

  const reached = access === 'read' ? readReaches(context, held) : context.tenantId === held.recorded;

  if (!reached) {
    throw new EventStreamTenantError(held.stream);
  }
}

function readReaches({ elevation, tenantId }: ExecutionContext, { recorded }: HeldStream): boolean {
  if (elevation === undefined) {
    return tenantId === recorded;
  }

  return elevation.tenants === 'all' || (recorded !== undefined && elevation.tenants.includes(recorded));
}
