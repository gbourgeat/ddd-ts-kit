import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  executionContext,
  inEventScope,
  scopedPublisher,
  systemActor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { InvoicingFailed, PLACED, anEvent, unique } from './support/events.js';
import { REAL_SERVER, SERVER_URL } from './support/server.js';
import { Server } from './support/streams.js';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, the execution scope of a handler', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('carries the correlation of the publishing work to the execution scope of the consumer', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const prefix = unique('test-events');
    const bus = server.bus({ prefix });
    const seen: (ExecutionContext | undefined)[] = [];

    bus.subscribe(
      PLACED,
      inEventScope(scope, { consumer: 'billing.invoice-on-order-placed' }, async () => void seen.push(scope.current())),
    );

    const request = executionContext({ correlationId: 'corr-7', actor: systemActor('checkout'), origin: 'http' });

    await scope.run(request, () => scopedPublisher(bus, scope).publish([anEvent('evt-1')]));
    await scopedPublisher(bus, scope).publish([anEvent('evt-2')]);
    await server.settled(bus);

    expect((await server.entries(`${prefix}:${PLACED}`))[0]?.fields).toMatchObject({ id: 'evt-1', 'correlation-id': 'corr-7' });

    expect(seen).toEqual([
      { correlationId: 'corr-7', causationId: 'evt-1', actor: systemActor('billing.invoice-on-order-placed'), origin: 'event', extensions: {} },
      { correlationId: 'evt-2', causationId: 'evt-2', actor: systemActor('billing.invoice-on-order-placed'), origin: 'event', extensions: {} },
    ]);

    expect(scope.current()).toBeUndefined();
  });

  it('runs every handler inside the execution scope it was given, under the name of the consumer', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const bus = server.bus({ scope });
    const seen: (ExecutionContext | undefined)[] = [];

    bus.forConsumer('billing').subscribe(PLACED, async () => void seen.push(scope.current()));

    await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-7' }]);
    await server.settled(bus);

    expect(seen).toEqual([{ correlationId: 'corr-7', causationId: 'evt-1', actor: systemActor('billing'), origin: 'event', extensions: {} }]);
  });

  it('keeps the correlation across a retry: the redelivery runs in the same context', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const bus = server.bus({ scope });
    const correlations: (string | undefined)[] = [];
    let failures = 1;

    bus.subscribe(PLACED, async () => {
      correlations.push(scope.current()?.correlationId);

      if (failures > 0) {
        failures -= 1;
        throw new InvoicingFailed();
      }
    });

    await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-1' }]);
    await server.settled(bus);

    expect(correlations).toEqual(['corr-1', 'corr-1']);
  });
});
