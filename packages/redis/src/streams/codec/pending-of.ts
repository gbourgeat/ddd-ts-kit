import { listOf } from '../../replies/list-of.js';
import type { PendingEntry } from './pending-entry.js';

/** The reply of the extended `XPENDING`: id, owner, idle time, delivery counter. */
export function pendingOf(reply: unknown): PendingEntry[] {
  return listOf(reply).flatMap((answer) => {
    const [id, consumer, , deliveries] = listOf(answer);

    return typeof id === 'string' && typeof consumer === 'string' ? [{ id, consumer, deliveries: Number(deliveries) }] : [];
  });
}
