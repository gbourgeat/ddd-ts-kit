import { afterAll, describe, expect, it } from 'vitest';
import { Command, InMemoryCommandBus, InMemoryEventBus, SystemClock, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore, OutboxRelay, type RelaySignal } from '@ddd-ts-kit/events';
import { RedisRelaySignal, relayWakeUpMiddleware } from '../src';
import { REAL_SERVER, aNamespace, closeAll, connect, connectToNothing, sleep } from './support/server';

afterAll(closeAll);

class IssueInvoice extends Command {}

const issued = (id: string): IntegrationEvent => ({
  id,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: {},
});

describe.skipIf(!REAL_SERVER)('RedisRelaySignal on a server', () => {
  it('wakes the listeners of another process, and only those of its channel', async () => {
    const channel = aNamespace();

    const [here, there, elsewhere] = [
      new RedisRelaySignal(connect(), { channel }),
      new RedisRelaySignal(connect(), { channel }),
      new RedisRelaySignal(connect(), { channel: aNamespace() }),
    ];

    const woken: string[] = [];

    there.subscribe(() => void woken.push('there'));
    there.subscribe(() => void woken.push('there too'));
    elsewhere.subscribe(() => void woken.push('elsewhere'));
    await sleep(100);

    await here.notify();

    await expect.poll(() => woken).toEqual(['there', 'there too']);
    await Promise.all([here.close(), there.close(), elsewhere.close()]);
  });

  it('stops waking a listener that unsubscribed, and everybody once closed', async () => {
    const channel = aNamespace();
    const [here, there] = [new RedisRelaySignal(connect(), { channel }), new RedisRelaySignal(connect(), { channel })];
    const woken: string[] = [];
    const first = there.subscribe(() => void woken.push('first'));

    there.subscribe(() => void woken.push('second'));
    await sleep(100);

    first.unsubscribe();
    await here.notify();
    await expect.poll(() => woken).toEqual(['second']);
    await there.close();
    await here.notify();
    await sleep(100);

    expect(woken).toEqual(['second']);
    await here.close();
  });

  it('makes an outbox relay of another process publish at once, although its interval is long', async () => {
    const channel = aNamespace();

    const [inTheApi, inTheWorker] = [
      new RedisRelaySignal(connect(), { channel }),
      new RedisRelaySignal(connect(), { channel }),
    ];

    // Typed as the port of the events package: the structural type of this package must fit it.
    const wakeOn: RelaySignal = inTheWorker;
    const store = new InMemoryOutboxStore();
    const bus = new InMemoryEventBus();
    const relay = new OutboxRelay({ store, publisher: bus, clock: new SystemClock(), wakeOn });

    relay.start({ intervalMs: 60_000 });
    await sleep(150);

    const commands = new InMemoryCommandBus()
      .use(relayWakeUpMiddleware(inTheApi))
      .register(IssueInvoice, { execute: () => store.append([issued('evt-1')]) });

    await commands.execute(new IssueInvoice());

    await expect.poll(() => bus.published.map((event) => event.id), { timeout: 3_000 }).toEqual(['evt-1']);
    await relay.stop();
    await Promise.all([inTheApi.close(), inTheWorker.close()]);
  });
});

describe('RedisRelaySignal while the server is away', () => {
  it('never fails to notify: the relay publishes at its next poll', async () => {
    const signal = new RedisRelaySignal(connectToNothing());

    await expect(signal.notify()).resolves.toBeUndefined();
  });
});

describe('relayWakeUpMiddleware', () => {
  it('notifies after a command that succeeded, never after one that failed, and gives its answer through', async () => {
    const notified: string[] = [];

    const commands = new InMemoryCommandBus()
      .use(relayWakeUpMiddleware({ notify: async () => void notified.push('woken') }))
      .register(IssueInvoice, { execute: async () => undefined });

    const failing = new InMemoryCommandBus()
      .use(relayWakeUpMiddleware({ notify: async () => void notified.push('woken after a failure') }))
      .register(IssueInvoice, { execute: async () => Promise.reject(new Error('The handler failed')) });

    await commands.execute(new IssueInvoice());
    await expect(failing.execute(new IssueInvoice())).rejects.toThrow('The handler failed');

    expect(notified).toEqual(['woken']);
  });

  it('does not let a signal that fails break the command', async () => {
    const commands = new InMemoryCommandBus()
      .use(relayWakeUpMiddleware({ notify: async () => Promise.reject(new Error('The signal is broken')) }))
      .register(IssueInvoice, { execute: async () => undefined });

    await expect(commands.execute(new IssueInvoice())).resolves.toBeUndefined();
  });
});
