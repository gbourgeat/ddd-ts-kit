import type { ExecutionContext } from '../execution/execution-context';
import { EventStreamTenantError } from './event-stream-tenant-error';

/** A stream that already holds events, and the tenant its first append recorded (none for a stream stored without one). */
export interface HeldStream {
  readonly stream: string;
  readonly recorded: string | undefined;
}

/**
 * What an event store checks before it hands out or extends a stream that already holds events.
 * Work that names no tenant and opened no elevation is not scoped, so nothing is refused (a project
 * without tenancy). An elevation (`acrossTenants`) widens a read to its tenants, never a write: a
 * write names one tenant.
 */
export function assertStreamReach(
  context: ExecutionContext | undefined,
  held: HeldStream,
  access: 'read' | 'write',
): void {
  const reached = access === 'read' ? readReaches(context, held) : writeReaches(context, held);

  if (!reached) {
    throw new EventStreamTenantError(held.stream);
  }
}

function readReaches(context: ExecutionContext | undefined, { recorded }: HeldStream): boolean {
  const elevation = context?.elevation;

  if (elevation === undefined) {
    return ownsOrUnscoped(context?.tenantId, recorded);
  }

  return elevation.tenants === 'all' || (recorded !== undefined && elevation.tenants.includes(recorded));
}

function writeReaches(context: ExecutionContext | undefined, { recorded }: HeldStream): boolean {
  if (context?.tenantId === undefined) {
    return context?.elevation === undefined;
  }

  return context.tenantId === recorded;
}

function ownsOrUnscoped(tenantId: string | undefined, recorded: string | undefined): boolean {
  return tenantId === undefined || tenantId === recorded;
}
