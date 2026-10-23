import type { Removal } from './history';
import type { RemovedBy } from './stale-citation';

/** What a report says of a removal: its commit, day and subject when it was committed, and the path removed. */
export function removedByOf(removal: Removal): RemovedBy {
  const { commit, date, subject, path } = removal;

  return commit === undefined ? { path } : { commit, date: date ?? '', subject: subject ?? '', path };
}
