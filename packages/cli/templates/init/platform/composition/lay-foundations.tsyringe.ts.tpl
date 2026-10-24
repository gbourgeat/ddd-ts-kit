{{#unless audit.on}}
import type { OnDecision } from '@ddd-ts-kit/auth';
{{/unless}}
import {
  AsyncLocalStorageExecutionScope,
  SystemClock,
  UuidGenerator,
  type Clock,
  type ExecutionScope,
  type IdGenerator,
  type Logger,
  type Metrics,
} from '@ddd-ts-kit/kernel';
import { traceApplication, type ConsumerTrace, type TracedApplication } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { createAudit, type Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
{{#unless audit.on}}
import { logDecisions } from '{{alias.platform}}/auth/authorization/log-decisions{{alias.ext}}';
{{/unless}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if eventSourcing.on}}
import { createEventSourcing, type EventSourcing } from '{{alias.platform}}/event-sourcing/create-event-sourcing{{alias.ext}}';
{{/if}}
import { createLogger, type LogSettings } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
import { createMetrics } from '{{alias.platform}}/observability/create-metrics{{alias.ext}}';

/**
 * What exists before any module: built once and handed to the kernel module, so that the buses,
 * the logger{{#if audit.on}}, the audit sources{{/if}} and every adapter read one execution scope, one clock and one
 * generator.
 */
export interface Foundations {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly metrics: Metrics;
  /** What observes the application from outside: handed to the kernel module, and to the buses this platform builds itself. */
  readonly traced: TracedApplication;
{{#if audit.on}}
  readonly audit: Audit;
{{/if}}
{{#unless audit.on}}
  /** What every authorization decision is told to: the log, since the audit trail is off. */
  readonly decisions: OnDecision;
{{/unless}}
{{#if eventSourcing.on}}
  /** The event store, the keys of the data subjects{{#if audit.on}}, audited,{{/if}} and the cipher of the personal values of the stored events. */
  readonly eventSourcing: EventSourcing;
{{/if}}
}

interface Observed {
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
}

export function layFoundations(persistence: Persistence, options: Observed): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const logger = createLogger(scope, options.log);
{{#if audit.on}}
  const audit = createAudit(persistence, { scope, clock, ids });
{{/if}}

  return {
    scope,
    clock,
    ids,
    logger,
    metrics: createMetrics(),
    traced: traceApplication({ consumers: options.traceConsumers ?? 'continue' }),
{{#if audit.on}}
    audit,
{{#if eventSourcing.on}}
    eventSourcing: createEventSourcing(persistence, audit, { scope, clock, ids }),
{{/if}}
{{/if}}
{{#unless audit.on}}
    decisions: logDecisions(logger),
{{#if eventSourcing.on}}
    eventSourcing: createEventSourcing(persistence),
{{/if}}
{{/unless}}
  };
}
