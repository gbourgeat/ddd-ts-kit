import type { ActorType } from '../actor/actor-type.js';

/** Who acted, as identifiers only: never a name, an email or a role list. */
export interface AuditActor {
  readonly id: string;
  /** `unknown` when a decision concerned somebody else than the actor of the work in progress. */
  readonly type: ActorType | 'unknown';
  readonly tenantId?: string;
}
