{{#unless audit.on}}
import type { OnDecision } from '@ddd-ts-kit/auth';
{{/unless}}
import {
  AsyncLocalStorageExecutionScope,
  InMemoryCache,
  InMemoryLock,
{{#if cache.rateLimit}}
  InMemoryRateLimiter,
{{/if}}
{{#if errors.sentry}}
  NoopErrorReporter,
{{/if}}
  SystemClock,
  UuidGenerator,
  type JobScheduler,
} from '@ddd-ts-kit/kernel';
{{#if errors.none}}
import { InProcessJobScheduler, type InProcessJobSchedulerOptions } from '@ddd-ts-kit/scheduling';
{{/if}}
{{#if errors.sentry}}
import { InProcessJobScheduler, reportFailedRuns, type InProcessJobSchedulerOptions } from '@ddd-ts-kit/scheduling';
{{/if}}
import { traceApplication, type TracedApplication } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { createAudit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
{{#unless audit.on}}
import { logDecisions } from '{{alias.platform}}/auth/authorization/log-decisions{{alias.ext}}';
{{/unless}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import type { PlatformOptions } from '{{alias.platform}}/composition/platform-options{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { ConfiguredJobScheduler } from '{{alias.platform}}/jobs/configured-job-scheduler{{alias.ext}}';
import { createLogger } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
import { createMetrics } from '{{alias.platform}}/observability/create-metrics{{alias.ext}}';

type Founded = 'scope' | 'clock' | 'ids' | 'logger' | 'metrics'{{#if errors.sentry}} | 'errors'{{/if}} | 'cache' | 'jobs'{{#if cache.rateLimit}} | 'rateLimiter'{{/if}}{{#if audit.on}} | 'audit'{{/if}};

/**
 * What exists before anything else: one execution scope, one clock and one generator for the
 * buses, the logger and every adapter{{#if audit.on}}, the audit sources{{/if}}, and what observes the application from outside.
 */
export interface Foundations extends Pick<Platform, Founded> {
  /** One span per use case, adapter call, domain event, publication, consumer and job: handed to the buses and to every adapter. */
  readonly traced: TracedApplication;
{{#unless audit.on}}
  /** What every authorization decision is told to: the log, since the audit trail is off. */
  readonly decisions: OnDecision;
{{/unless}}
}

export function layFoundations(persistence: Persistence, options: PlatformOptions): Foundations {
  const traced = traceApplication({ consumers: options.traceConsumers ?? 'continue' });
  const scope = new AsyncLocalStorageExecutionScope();

  // Spans and log fields carry the correlation id of the work in progress.
  traced.executionScope(scope);

  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const logger = createLogger(scope, options.log);
  const metrics = createMetrics();
{{#if errors.sentry}}
  // Reports carry the id of the trace they happened in.
  const errors = traced.errorReporter(options.errors ?? new NoopErrorReporter());
{{/if}}
{{#if cache.redis}}
  const lock = options.redis?.lock ?? new InMemoryLock(clock);
{{/if}}
{{#unless cache.redis}}
  // TODO(platform): this lock excludes inside one process only. Before running several instances, give the scheduler a lock between processes (`RedisLock` of @ddd-ts-kit/redis), or each instance runs every job.
  const lock = new InMemoryLock(clock);
{{/unless}}

  return {
    traced,
    scope,
    clock,
    ids,
    logger,
    metrics,
{{#if errors.sentry}}
    errors,
{{/if}}
{{#if cache.redis}}
    cache: options.redis?.cache(metrics) ?? new InMemoryCache(clock),
{{/if}}
{{#unless cache.redis}}
    cache: new InMemoryCache(clock),
{{/unless}}
{{#if cache.rateLimit}}
    rateLimiter: options.redis?.rateLimiter ?? new InMemoryRateLimiter(clock),
{{/if}}
{{#if errors.none}}
    jobs: schedulerOf(options, traced, { clock, lock, scope, ids, logger, metrics }),
{{/if}}
{{#if errors.sentry}}
    // A run that failed, a timeout included, is reported; a skipped or missed occurrence is not.
    jobs: schedulerOf(options, traced, { clock, lock, scope, ids, logger, metrics, onRun: reportFailedRuns(errors) }),
{{/if}}
{{#if audit.on}}
    audit: createAudit(persistence, { scope, clock, ids }),
{{/if}}
{{#unless audit.on}}
    decisions: logDecisions(logger),
{{/unless}}
  };
}

/** The scheduler of the process, with the settings of the configuration applied and each run observed from outside. */
function schedulerOf(
  options: PlatformOptions,
  traced: TracedApplication,
  parts: InProcessJobSchedulerOptions,
): JobScheduler {
  return new ConfiguredJobScheduler(new InProcessJobScheduler(parts), options.jobs?.settings ?? {}, traced.job);
}
