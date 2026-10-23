import { listOf } from '../../replies/list-of';
import type { PendingEntry } from './pending-entry';

/** The reply of the extended `XPENDING`: id, owner, idle time, delivery counter. */
export function pendingOf(reply: unknown): PendingEntry[] {
  return listOf(reply).flatMap((answer) => {
    const [id, consumer, , deliveries] = listOf(answer);

    return typeof id === 'string' && typeof consumer === 'string'
      ? [{ id, consumer, deliveries: Number(deliveries) }]
      : [];
  });
}
