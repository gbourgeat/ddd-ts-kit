import { describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemoryLogger,
  InMemoryUnitOfWork,
  type StoredEvent,
} from '@ddd-ts-kit/kernel';
import { startCatchUp } from '@/platform/events/start-catch-up';

const at = new Date('2026-03-02T09:00:00.000Z');

describe('startCatchUp', () => {
  it('applies what the store holds at once, then what is appended later, until it is stopped', async () => {
    const { store, applied, subscription } = await arrange();
    const running = startCatchUp({ subscriptions: [subscription], intervalMs: 5, logger: new InMemoryLogger() });

    await store.append('stream-1', 1, [{ id: 'e2', type: 'probe', schemaVersion: 1, data: {}, occurredAt: at }]);
    await until(() => applied.length === 2);
    await running.stop();

    expect(applied).toEqual(['e1', 'e2']);
  });

  it('logs a failed round and goes on at the next one', async () => {
    const logger = new InMemoryLogger();

    const failing = new CatchUpSubscription({
      name: 'scheduling.failing',
      store: new InMemoryEventStore(),
      checkpoints: new InMemoryCheckpointStore(),
      unitOfWork: { run: () => Promise.reject(new Error('the database is down')) },
      apply: async () => undefined,
    });

    const running = startCatchUp({ subscriptions: [failing], intervalMs: 5, logger });

    await until(() => logger.entries.length >= 2);
    await running.stop();

    expect(logger.entries[0]).toMatchObject({ level: 'error', message: 'projection catch-up failure' });
  });
});

async function arrange() {
  const store = new InMemoryEventStore();
  const applied: string[] = [];

  await store.append('stream-1', 0, [{ id: 'e1', type: 'probe', schemaVersion: 1, data: {}, occurredAt: at }]);

  const subscription = new CatchUpSubscription({
    name: 'scheduling.probe',
    store,
    checkpoints: new InMemoryCheckpointStore(),
    unitOfWork: new InMemoryUnitOfWork(),
    apply: async (event: StoredEvent) => void applied.push(event.id),
  });

  return { store, applied, subscription };
}

async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !condition(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
