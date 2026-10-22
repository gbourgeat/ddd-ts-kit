import { errorReportOf } from '../../application/error-reporting/error-report-of';
import type { ErrorReport } from '../../application/error-reporting/error-report';
import { isUnexpectedError } from '../../application/error-reporting/is-unexpected-error';
import { reportOnce } from '../../application/error-reporting/report-once';
import type { IntegrationEventCallback } from '../../application/events/integration-event-callback';
import type { IntegrationEvent } from '../../application/events/integration-event';
import type { ErrorReporter } from '../../application/ports/error-reporter';
import type { IntegrationEventSubscriber } from '../../application/ports/integration-event-subscriber';
import { DeadLetterError } from './dead-letter-error';

/**
 * What the `onFailure` hook of every provider says, read structurally: the broker adapters
 * (`handler`, `poison`, `connection`) and the outbox relay (`publish`, `tick`) all fit.
 */
export interface DeliveryFailure {
  readonly kind: string;
  readonly code: string;
  /** The provider gave the event up: retries exhausted, sent to the dead-letter destination. */
  readonly dead?: boolean;
  /** Which delivery failed, counted from 1. */
  readonly attempt?: number;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly consumer?: string;
  readonly queue?: string;
  readonly stream?: string;
  readonly topic?: string;
}

export interface DeadLetterReportsOptions {
  /** How many failed deliveries are remembered while their provider decides. Default 1 000. */
  readonly capacity?: number;
}

interface Thrown {
  readonly error: unknown;
  readonly correlationId: string;
  readonly traceId?: string;
}

const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * Reports the events a provider gives up, and only those: a delivery that fails and is retried
 * is the normal life of an at-least-once consumer. The hooks of the providers say codes only,
 * so `observing` remembers what each handler threw until `onFailure` hears what became of the
 * event; the report of a buried event then carries the real error and its stack. A business
 * refusal that buries an event is reported as a `warning`: the event is lost to its consumer
 * all the same. One memory per event id: of two consumers failing the same event in the same
 * process, the last one is remembered.
 */
export class DeadLetterReports {
  private readonly thrown = new Map<string, Thrown>();

  private readonly capacity: number;

  constructor(
    private readonly reporter: ErrorReporter,
    options: DeadLetterReportsOptions = {},
  ) {
    this.capacity = options.capacity ?? 1_000;
  }

  /** The subscriber to hand to the application in place of the provider's. */
  observing(subscriber: IntegrationEventSubscriber): IntegrationEventSubscriber {
    return {
      subscribe: (type, handler) => subscriber.subscribe(type, (event) => this.watched(event, handler)),
    };
  }

  /** The `onFailure` hook of the provider: `onFailure: (failure) => deadLetters.onFailure(failure)`. */
  onFailure(failure: DeliveryFailure): void {
    if (failure.dead !== true && failure.kind !== 'poison') {
      return;
    }

    const thrown = failure.eventId === undefined ? undefined : this.thrown.get(failure.eventId);

    if (failure.eventId !== undefined) {
      this.thrown.delete(failure.eventId);
    }

    const error = thrown?.error ?? new DeadLetterError(failure.kind, failure.code);

    reportOnce(this.reporter, error, reportOf(failure, error, thrown));
  }

  private async watched(event: IntegrationEvent, handler: IntegrationEventCallback): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      this.remember(event, error);

      throw error;
    }
  }

  private remember(event: IntegrationEvent, error: unknown): void {
    const traceId = TRACEPARENT.exec(event.traceparent ?? '')?.[1];

    this.thrown.delete(event.id);

    this.thrown.set(event.id, {
      error,
      correlationId: event.correlationId ?? event.id,
      ...(traceId === undefined ? {} : { traceId }),
    });

    for (const oldest of this.thrown.keys()) {
      if (this.thrown.size <= this.capacity) {
        break;
      }

      this.thrown.delete(oldest);
    }
  }
}

function reportOf(failure: DeliveryFailure, error: unknown, thrown: Thrown | undefined): ErrorReport {
  const correlationId = thrown?.correlationId ?? failure.eventId;

  return errorReportOf(error, {
    origin: 'event',
    operation: operationOf(failure),
    errorCode: failure.code,
    severity: isUnexpectedError(error) ? 'error' : 'warning',
    ...(failure.consumer === undefined ? {} : { context: failure.consumer.split('.', 1).join('') }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(thrown?.traceId === undefined ? {} : { traceId: thrown.traceId }),
  });
}

/** The event type and where it was going: the consumer when the provider names it, else its queue, stream or topic. */
function operationOf(failure: DeliveryFailure): string {
  const destination = failure.consumer ?? failure.queue ?? failure.stream ?? failure.topic;

  return [failure.eventType ?? failure.kind, destination].filter((part) => part !== undefined).join(' ');
}
