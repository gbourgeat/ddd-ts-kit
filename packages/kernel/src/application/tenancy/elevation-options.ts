import type { AuditTrail } from '../ports/audit-trail.js';
import type { Clock } from '../ports/clock.js';
import type { ExecutionScope } from '../ports/execution-scope.js';
import type { IdGenerator } from '../ports/id-generator.js';

/** What `acrossTenants` needs: the scope it widens, and the trail it records the elevation in. */
export interface ElevationOptions {
  readonly scope: ExecutionScope;
  readonly trail: AuditTrail;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
