import {
  executionContext,
  systemActor,
  type AuditRecord,
  type AuditTrail,
  type Clock,
  type ExecutionContext,
  type ExecutionScope,
  type IdGenerator,
  type IntegrationEvent,
  type ProcessedEventStore,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { AuditSubscription } from './audit-subscription.js';
import type { AuditedEvents } from './audited-events.js';
import { recordIn } from './record-in.js';

export interface AuditIntegrationEventsOptions {
  readonly registry: AuditedEvents;

  readonly clock: Clock;

  readonly ids: IdGenerator;

  /** At-least-once delivery is the rule: an event redelivered is recorded once. */
  readonly processed: ProcessedEventStore;

  /** When given, the mark and the entry commit together. */
  readonly unitOfWork?: UnitOfWork;

  /** When the consumer boundary opens an execution context, its actor and session are kept. */
  readonly scope?: ExecutionScope;

  /** The idempotency scope, and the name of the system actor. Default `audit`. */
  readonly consumer?: string;
}

/**
 * One subscription per event type of the registry, each recording that the event happened.
 * Only the envelope is read (type, id, correlation), never the payload: the trail says that
 * `billing.invoice.issued` occurred and under which correlation, not what it contained.
 */
export function auditIntegrationEvents(trail: AuditTrail, options: AuditIntegrationEventsOptions): AuditSubscription[] {
  const types = [...new Set(options.registry.all().map((definition) => definition.type))];

  return types.map((type) => ({ type, handler: (event) => recordOnce(trail, options, event) }));
}

const WITHOUT_TRANSACTION: UnitOfWork = { run: (work) => work() };

async function recordOnce(
  trail: AuditTrail,
  options: AuditIntegrationEventsOptions,
  event: IntegrationEvent,
): Promise<void> {
  const { processed, consumer = 'audit' } = options;
  const mark = { taken: false };

  try {
    await (options.unitOfWork ?? WITHOUT_TRANSACTION).run(async () => {
      mark.taken = await processed.markProcessed(consumer, event.id);

      if (mark.taken) {
        await trail.record(recordOfEvent(event, options));
      }
    });
  } catch (error) {
    // Only a mark taken by this delivery, and only where no rollback already removed it.
    if (mark.taken) {
      await processed.release?.(consumer, event.id);
    }

    throw error;
  }
}

function recordOfEvent(event: IntegrationEvent, options: AuditIntegrationEventsOptions): AuditRecord {
  const fact = {
    category: 'integration-event',
    action: event.type,
    outcome: 'succeeded',
    ...contextOf(event.type),
  } as const;

  return recordIn(contextOfDelivery(event, options), options, fact);
}

function contextOfDelivery(event: IntegrationEvent, options: AuditIntegrationEventsOptions): ExecutionContext {
  const current = options.scope?.current();
  const correlationId = event.correlationId ?? current?.correlationId ?? event.id;

  if (current !== undefined) {
    return { ...current, correlationId, causationId: event.id };
  }

  return executionContext({
    correlationId,
    causationId: event.id,
    actor: systemActor(options.consumer ?? 'audit'),
    origin: 'event',
  });
}

/** An event type is `<context>.<aggregate>.<fact>`. */
function contextOf(type: string): { readonly context?: string } {
  const separator = type.indexOf('.');

  return separator > 0 ? { context: type.slice(0, separator) } : {};
}
