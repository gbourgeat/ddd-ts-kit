import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  SequentialIdGenerator,
  ok,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import { createEventRegistry, defineIntegrationEvent, subscribeAll } from '@ddd-ts-kit/events';
import { InMemoryAuditTrail, auditIntegrationEvents, type AuditRecord, type AuditTrail } from '../src';
import { NOW, ada, requestOf } from './support/fixtures';
import { StagingUnitOfWork } from './support/staging-unit-of-work';
import { TransactionalAuditTrail } from './support/transactional-audit-trail';

const anything = { parse: (input: unknown) => ok(input), toJsonSchema: () => ({}) };

const registry = createEventRegistry([
  defineIntegrationEvent({ type: 'scheduling.appointment.cancelled', version: 1, payload: anything }),
  defineIntegrationEvent({ type: 'scheduling.appointment.cancelled', version: 2, payload: anything }),
  defineIntegrationEvent({ type: 'billing.invoice.issued', version: 1, payload: anything }),
]);

function cancelled(id: string, more: Partial<IntegrationEvent> = {}): IntegrationEvent {
  return {
    id,
    type: 'scheduling.appointment.cancelled',
    version: 1,
    occurredAt: '2026-03-01T09:59:00.000Z',
    payload: { appointmentId: 'apt-1', patientEmail: 'lin@example.org' },
    ...more,
  };
}

function wiring(trail: AuditTrail = new InMemoryAuditTrail()) {
  return {
    trail,
    clock: new FixedClock(NOW),
    ids: new SequentialIdGenerator('audit'),
    processed: new InMemoryProcessedEventStore(),
    bus: new InMemoryEventBus(),
  };
}

describe('auditIntegrationEvents', () => {
  it('subscribes once to every event type of the registry, whatever its versions', () => {
    const { trail, ...options } = wiring();

    const subscriptions = auditIntegrationEvents(trail, { ...options, registry });

    expect(subscriptions.map((subscription) => subscription.type)).toEqual([
      'billing.invoice.issued',
      'scheduling.appointment.cancelled',
    ]);
  });

  it('records that the event happened from its envelope alone, never its payload', async () => {
    const trail = new InMemoryAuditTrail();
    const { bus, ...options } = wiring(trail);

    subscribeAll(bus, auditIntegrationEvents(trail, { ...options, registry }));

    await bus.publish([cancelled('evt-1', { correlationId: 'correlation-9' })]);

    expect(trail.entries).toEqual([
      {
        id: 'audit-1',
        chain: 'global',
        sequence: 1,
        occurredAt: NOW,
        category: 'integration-event',
        action: 'scheduling.appointment.cancelled',
        outcome: 'succeeded',
        actor: { id: 'system:audit', type: 'system' },
        context: 'scheduling',
        correlationId: 'correlation-9',
        causationId: 'evt-1',
        origin: 'event',
        extensions: {},
        previousHash: trail.entries[0]?.previousHash,
        hash: trail.entries[0]?.hash,
      },
    ]);

    expect(JSON.stringify(trail.entries)).not.toContain('lin@example.org');
  });

  it('records a redelivered event once, and each event of a type', async () => {
    const trail = new InMemoryAuditTrail();
    const { bus, ...options } = wiring(trail);

    subscribeAll(bus, auditIntegrationEvents(trail, { ...options, registry }));

    await bus.publish([cancelled('evt-1'), cancelled('evt-1'), cancelled('evt-2', { version: 2 })]);
    await bus.publish([cancelled('evt-1')]);

    expect(trail.entries.map((entry) => entry.causationId)).toEqual(['evt-1', 'evt-2']);
  });

  it('falls back on the id of the event when it carries no correlation', async () => {
    const trail = new InMemoryAuditTrail();
    const { bus, ...options } = wiring(trail);

    subscribeAll(bus, auditIntegrationEvents(trail, { ...options, registry }));

    await bus.publish([cancelled('evt-1')]);

    expect(trail.entries[0]).toMatchObject({ correlationId: 'evt-1', causationId: 'evt-1' });
  });

  it('keeps the actor and the tenant of the context the consumer boundary opened', async () => {
    const trail = new InMemoryAuditTrail();
    const { bus, ...options } = wiring(trail);
    const scope = new FixedExecutionScope(requestOf(ada, { origin: 'event', correlationId: 'from-the-boundary' }));

    subscribeAll(bus, auditIntegrationEvents(trail, { ...options, registry, scope, consumer: 'audit-trail' }));

    await bus.publish([cancelled('evt-1', { correlationId: 'from-the-envelope' })]);

    expect(trail.entries[0]).toMatchObject({
      actor: { id: 'ada', type: 'user', tenantId: 'acme' },
      chain: 'tenant:acme',
      correlationId: 'from-the-envelope',
      causationId: 'evt-1',
    });
  });
});

describe('auditIntegrationEvents when the entry cannot be written or committed', () => {
  it('records the redelivery of an event whose entry could not be written the first time', async () => {
    const committed = new InMemoryAuditTrail();
    const failing = { times: 1 };

    const flaky: AuditTrail = {
      record: async (record: AuditRecord) => {
        if (failing.times > 0) {
          failing.times -= 1;
          throw new Error('The audit store is unreachable');
        }

        await committed.record(record);
      },
    };

    const { bus, ...options } = wiring(flaky);

    subscribeAll(bus, auditIntegrationEvents(flaky, { ...options, registry }));

    await expect(bus.publish([cancelled('evt-1')])).rejects.toThrow(AggregateError);
    await bus.publish([cancelled('evt-1')]);

    expect(committed.entries.map((entry) => entry.causationId)).toEqual(['evt-1']);
  });

  it('commits the mark and the entry together when given a unit of work', async () => {
    const committed = new InMemoryAuditTrail();
    const unitOfWork = new StagingUnitOfWork();
    const trail = new TransactionalAuditTrail(unitOfWork, committed);
    const { bus, ...options } = wiring(trail);

    subscribeAll(bus, auditIntegrationEvents(trail, { ...options, registry, unitOfWork }));

    unitOfWork.failOnCommit = true;
    await expect(bus.publish([cancelled('evt-1')])).rejects.toThrow(AggregateError);
    expect(committed.entries).toEqual([]);

    unitOfWork.failOnCommit = false;
    await bus.publish([cancelled('evt-1')]);
    expect(committed.entries.map((entry) => entry.causationId)).toEqual(['evt-1']);
  });
});
