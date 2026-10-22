import { FixedClock } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore, OutboxRelay, type OutboxRelayFailure } from '../../src';
import { at } from './events';
import { FlakyPublisher } from './flaky-publisher';

export interface RelaySetup {
  readonly clock: FixedClock;
  readonly store: InMemoryOutboxStore;
  readonly publisher: FlakyPublisher;
  readonly relay: OutboxRelay;
  readonly reported: OutboxRelayFailure[];
}

/** A relay on a fixed clock, whose provider refuses the listed events that many times. */
export function setupRelay(failures: Record<string, number> = {}, maxAttempts = 3): RelaySetup {
  const clock = new FixedClock(at);
  const store = new InMemoryOutboxStore({ leaseMs: 60_000 });
  const publisher = new FlakyPublisher(failures);
  const reported: OutboxRelayFailure[] = [];

  const relay = new OutboxRelay({
    store,
    publisher,
    clock,
    maxAttempts,
    backoff: { baseMs: 1_000, factor: 2, maxMs: 3_000 },
    onFailure: (failure) => reported.push(failure),
  });

  return { clock, store, publisher, relay, reported };
}
