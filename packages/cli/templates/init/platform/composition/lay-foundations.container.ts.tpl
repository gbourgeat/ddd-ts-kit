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
{{#if search.opensearch}}
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
{{/if}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if eventSourcing.on}}
import { createEventSourcing, type EventSourcing } from '{{alias.platform}}/event-sourcing/create-event-sourcing{{alias.ext}}';
{{/if}}
import { createLogger, type LogSettings } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
import { createMetrics } from '{{alias.platform}}/observability/create-metrics{{alias.ext}}';
{{#if search.opensearch}}
{{#if tenancy.any}}
import { tenantDirectory } from '{{alias.platform}}/composition/tenant-directory{{alias.ext}}';
{{/if}}
import { openSearch } from '{{alias.platform}}/search/open-search{{alias.ext}}';
import type { SearchIndexes } from '{{alias.platform}}/search/search-indexes{{alias.ext}}';
{{/if}}

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
{{#if search.opensearch}}
  /** The read models of OpenSearch, with the transport and the tenancy of the platform: what the adapter of a read model port is built from. */
  readonly search: SearchIndexes;
{{/if}}
}

interface Observed {
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
{{#if search.opensearch}}
  /** Where the read models of OpenSearch live: the configuration in `main.ts`; left out (the tools, the tests), no node. */
  readonly search?: AppConfig['search'];
{{#if tenancy.any}}
  /** The tenants whose read models are provisioned. */
  readonly tenants?: readonly string[];
{{/if}}
{{/if}}
}

export function layFoundations(persistence: Persistence, options: Observed): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const logger = createLogger(scope, options.log);
{{#if audit.on}}
  const audit = createAudit(persistence, { scope, clock, ids }, logger);
{{/if}}

  return {
    scope,
    clock,
    ids,
    logger,
    metrics: createMetrics(),
    traced: traceApplication({ consumers: options.traceConsumers ?? 'continue' }),
{{#if search.opensearch}}
{{#if tenancy.any}}
    search: openSearch(options.search, { logger, scope, directory: tenantDirectory(persistence, options.tenants) }),
{{/if}}
{{#unless tenancy.any}}
    search: openSearch(options.search, { logger }),
{{/unless}}
{{/if}}
{{#if audit.on}}
    audit,
{{#if eventSourcing.on}}
    eventSourcing: createEventSourcing(persistence, audit, { scope, clock, ids }),
{{/if}}
{{/if}}
{{#unless audit.on}}
    decisions: logDecisions(logger),
{{#if eventSourcing.on}}
    eventSourcing: createEventSourcing(persistence{{#if tenancy.any}}, scope{{/if}}),
{{/if}}
{{/unless}}
  };
}
