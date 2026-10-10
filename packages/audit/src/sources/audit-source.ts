import type { Clock, ExecutionScope, IdGenerator } from '@ddd-ts-kit/kernel';

/** What every source reads instead of being handed parameters by the use cases. */
export interface AuditSource {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
