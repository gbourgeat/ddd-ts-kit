import { setTimeout as sleep } from 'node:timers/promises';

/** The work a source still holds, as the stats of an outbox store give it: `failed` of them wait for a retry. */
export interface PendingCount {
  readonly pending: number;
  readonly failed?: number;
}

/**
 * How much work one source still holds, 0 once it has none. A piece of work counts from the moment
 * it is started until it has finished: an outbox record stays pending while the relay publishes it
 * and the handlers it reaches run, so the `stats()` of an outbox store are such a count.
 */
export type PendingWork = () => number | PendingCount | Promise<number | PendingCount>;

export interface SettledOptions {
  /** Default 2000. */
  readonly timeoutMs?: number;
  /** Default 10. */
  readonly intervalMs?: number;
}

/**
 * Resolves as soon as every source counts nothing pending: the work the requests so far started
 * has finished, and what it changed can be asserted at once, without a fixed delay. When the time
 * is up, fails naming each source still pending, how much it holds and how much of it failed.
 */
export async function settled(
  sources: Readonly<Record<string, PendingWork>>,
  options: SettledOptions = {},
): Promise<void> {
  const { timeoutMs = 2000, intervalMs = 10 } = options;
  const deadline = performance.now() + timeoutMs;

  for (;;) {
    const pending = await pendingOf(sources);

    if (pending.length === 0) {
      return;
    }

    if (performance.now() + intervalMs > deadline) {
      throw new Error(`Still pending after ${timeoutMs} ms: ${pending.join(', ')}`);
    }

    await sleep(intervalMs);
  }
}

/** `outbox: 2 (1 failed, waiting for a retry)` for each source that still holds work, in the order given. */
async function pendingOf(sources: Readonly<Record<string, PendingWork>>): Promise<string[]> {
  const counts = await Promise.all(
    Object.entries(sources).map(async ([name, count]) => ({ name, ...countOf(await count()) })),
  );

  return counts.filter(({ pending }) => pending > 0).map(described);
}

function described({ name, pending, failed }: Required<PendingCount> & { readonly name: string }): string {
  return failed > 0 ? `${name}: ${pending} (${failed} failed, waiting for a retry)` : `${name}: ${pending}`;
}

function countOf(work: number | PendingCount): Required<PendingCount> {
  return typeof work === 'number' ? { pending: work, failed: 0 } : { pending: work.pending, failed: work.failed ?? 0 };
}
