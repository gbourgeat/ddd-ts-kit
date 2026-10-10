import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryEventBus,
  executionContext,
  executionContextOfEvent,
  inEventScope,
  isSession,
  messagingSystemOf,
  anonymousSession,
  scopedPublisher,
  systemActor,
  systemSession,
  type Actor,
  type ExecutionContext,
  type IntegrationEvent,
} from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };

const placed = (overrides: Partial<IntegrationEvent> = {}): IntegrationEvent => ({
  id: 'evt-1',
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: { orderId: 'order-1' },
  ...overrides,
});

describe('executionContextOfEvent', () => {
  it('continues the correlation of the event, caused by the event, as the consumer', () => {
    const context = executionContextOfEvent(placed({ correlationId: 'corr-1' }), { consumer: 'billing.invoice' });

    expect(context).toEqual({
      correlationId: 'corr-1',
      causationId: 'evt-1',
      actor: systemActor('billing.invoice'),
      origin: 'event',
      extensions: {},
    });
  });

  it('starts a correlation at the event when it names none', () => {
    expect(executionContextOfEvent(placed(), { consumer: 'billing.invoice' }).correlationId).toBe('evt-1');
  });

  it('acts as the actor the project reads from its own envelope, with its tenant', () => {
    const context = executionContextOfEvent(placed(), { consumer: 'billing.invoice', actorOf: () => ada });

    expect(context).toMatchObject({ actor: ada, tenantId: 'acme' });
  });
});

describe('inEventScope', () => {
  it('runs each delivery in a context of its own, gone once the handler is done', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const bus = new InMemoryEventBus();
    const seen: (ExecutionContext | undefined)[] = [];

    bus.subscribe(
      'ordering.order.placed',
      inEventScope(scope, { consumer: 'billing.invoice' }, async () => void seen.push(scope.current())),
    );

    await bus.publish([placed({ correlationId: 'corr-1' }), placed({ id: 'evt-2' })]);

    expect(seen.map((context) => [context?.correlationId, context?.causationId])).toEqual([
      ['corr-1', 'evt-1'],
      ['evt-2', 'evt-2'],
    ]);

    expect(scope.current()).toBeUndefined();
  });
});

describe('scopedPublisher', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  const request = executionContext({ correlationId: 'corr-7', actor: ada, origin: 'http' });

  it('stamps the correlation of the work in progress on an event that names none', async () => {
    const bus = new InMemoryEventBus();

    await scope.run(request, () => scopedPublisher(bus, scope).publish([placed()]));

    expect(bus.published).toEqual([placed({ correlationId: 'corr-7' })]);
  });

  it('keeps the correlation an event already names, and stamps nothing outside of any work', async () => {
    const bus = new InMemoryEventBus();
    const publisher = scopedPublisher(bus, scope);

    await scope.run(request, () => publisher.publish([placed({ correlationId: 'corr-1' })]));
    await publisher.publish([placed({ id: 'evt-2' })]);

    expect(bus.published).toEqual([placed({ correlationId: 'corr-1' }), placed({ id: 'evt-2' })]);
  });
});

describe('isSession', () => {
  it('recognizes a session by its shape, and nothing else', () => {
    expect(isSession(anonymousSession())).toBe(true);
    expect(isSession(systemSession('relay'))).toBe(true);
    expect(isSession(ada)).toBe(false);
    expect(isSession({ ...systemSession('relay'), issuedAt: '2026-01-01' })).toBe(false);
    expect(isSession({ ...systemSession('relay'), actor: { id: 'ada' } })).toBe(false);
    expect(isSession(undefined)).toBe(false);
  });
});

describe('what observes the events from outside', () => {
  it('is told by the in-memory bus which delivery a handler receives', async () => {
    const bus = new InMemoryEventBus();
    const deliveries: unknown[] = [];

    bus.subscribe('ordering.order.placed', async (_event, delivery) => void deliveries.push(delivery));
    await bus.publish([placed()]);

    expect(deliveries).toEqual([{ attempt: 1, system: 'in-memory', destination: 'ordering.order.placed' }]);
  });

  it('reads the name of the transport on a publisher, through the decorator that stamps the correlation', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const outbox = { messagingSystem: 'outbox', publish: async (): Promise<void> => undefined };

    expect(messagingSystemOf(new InMemoryEventBus())).toBe('in-memory');
    expect(messagingSystemOf(scopedPublisher(outbox, scope))).toBe('outbox');
    expect(messagingSystemOf(scopedPublisher({ publish: outbox.publish }, scope))).toBeUndefined();
  });

  it('hands the delivery through the event scope to the handler', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const deliveries: unknown[] = [];

    const handler = inEventScope(
      scope,
      { consumer: 'billing' },
      async (_event, delivery) => void deliveries.push(delivery),
    );

    await handler(placed(), { attempt: 2, maxAttempts: 3 });

    expect(deliveries).toEqual([{ attempt: 2, maxAttempts: 3 }]);
  });
});
