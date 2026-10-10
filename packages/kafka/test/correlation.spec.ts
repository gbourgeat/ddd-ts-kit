import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  executionContext,
  inEventScope,
  scopedPublisher,
  systemActor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { InvoicingFailed } from './support/invoicing-failed.js';

describe.skipIf(KAFKA_BROKERS === undefined)('KafkaEventBus: correlation', { timeout: 60_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(KAFKA_BROKERS ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('carries the correlation of the publishing work to the execution scope of the consumer', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const bus = broker.bus();
    const seen: (ExecutionContext | undefined)[] = [];

    bus.subscribe(
      PLACED,
      inEventScope(scope, { consumer: 'billing.invoice-on-order-placed' }, async () => void seen.push(scope.current())),
    );

    const request = executionContext({ correlationId: 'corr-7', actor: systemActor('checkout'), origin: 'http' });

    await scope.run(request, () => scopedPublisher(bus, scope).publish([anEvent('evt-1')]));
    await scopedPublisher(bus, scope).publish([anEvent('evt-2')]);
    await broker.settled(bus);

    const [first] = await broker.recordsOf(broker.topicOf(PLACED));

    expect(first?.headers).toMatchObject({ 'x-event-id': 'evt-1', 'x-correlation-id': 'corr-7' });

    expect(seen).toEqual([
      {
        correlationId: 'corr-7',
        causationId: 'evt-1',
        actor: systemActor('billing.invoice-on-order-placed'),
        origin: 'event',
        extensions: {},
      },
      {
        correlationId: 'evt-2',
        causationId: 'evt-2',
        actor: systemActor('billing.invoice-on-order-placed'),
        origin: 'event',
        extensions: {},
      },
    ]);

    expect(scope.current()).toBeUndefined();
  });

  it('keeps the correlation across a retry: the redelivery runs in the same context', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const bus = broker.bus();
    const correlations: (string | undefined)[] = [];
    let failures = 1;

    bus.subscribe(
      PLACED,
      inEventScope(scope, { consumer: 'billing' }, async () => {
        correlations.push(scope.current()?.correlationId);

        if (failures > 0) {
          failures -= 1;
          throw new InvoicingFailed();
        }
      }),
    );

    await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-1' }]);
    await broker.settled(bus);

    expect(correlations).toEqual(['corr-1', 'corr-1']);
  });
});
