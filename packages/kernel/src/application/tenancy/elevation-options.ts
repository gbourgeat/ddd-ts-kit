import type { AuditTrail } from '../ports/audit-trail';
import type { Clock } from '../ports/clock';
import type { ExecutionScope } from '../ports/execution-scope';
import type { IdGenerator } from '../ports/id-generator';

/** What `acrossTenants` needs: the scope it widens, and the trail it records the elevation in. */
export interface ElevationOptions {
  readonly scope: ExecutionScope;
  readonly trail: AuditTrail;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
