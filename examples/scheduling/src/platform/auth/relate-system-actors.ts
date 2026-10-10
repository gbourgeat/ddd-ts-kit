import type { RelationTuple, RelationTupleStore } from '@ddd-ts-kit/auth/rebac';

/**
 * What the application does on its own behalf: the relationships of its system actors, one per
 * scheduled job whose command is protected (`generate job` adds it). An integration event
 * handler that sends a protected command needs its line too.
 */
const systemRelationships: readonly RelationTuple[] = [
  // ddd-ts-kit:system-grants
  {
    object: 'context:scheduling',
    relation: 'operator',
    subject: 'system:system:scheduling.expire-unconfirmed-appointments',
  },
  { object: 'context:identity', relation: 'operator', subject: 'system:system:identity.expire-delegations' },
  { object: 'context:notification', relation: 'operator', subject: 'system:system:notification.send-due-reminders' },
  // /ddd-ts-kit:system-grants
];

/** Written when the application starts, before any job runs; writing a tuple that exists changes nothing. */
export function relateSystemActors(tuples: RelationTupleStore): Promise<void> {
  return tuples.write(systemRelationships);
}
