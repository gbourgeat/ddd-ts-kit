{{#if errors.sentry}}
{{#if files.any}}
import type { ErrorReporter, FileStorage, JobSettings } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless files.any}}
import type { ErrorReporter, JobSettings } from '@ddd-ts-kit/kernel';
{{/unless}}
{{/if}}
{{#unless errors.sentry}}
{{#if files.any}}
import type { FileStorage, JobSettings } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless files.any}}
import type { JobSettings } from '@ddd-ts-kit/kernel';
{{/unless}}
{{/unless}}
import type { QueueWorkerOptions } from '@ddd-ts-kit/scheduling';
import type { ConsumerTrace } from '@ddd-ts-kit/tracing';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';
import type { LogSettings } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
{{#if cache.redis}}
import type { RedisServices } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings{{alias.ext}}';

interface JobsOptions {
  readonly start?: boolean;
  /** What configuration changes of a job, by job name: what `job-settings.ts` answers. */
  readonly settings?: Readonly<Record<string, JobSettings>>;
}

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
{{#if errors.sentry}}
  /** Where unexpected failures are reported: the reporter of `errors.ts` in `main.ts`; left out (the tools, the tests), nowhere. */
  readonly errors?: ErrorReporter;
{{/if}}
  /** The policy around every adapter that leaves the process; left out, `resilience/default-resilience-settings.ts`. */
  readonly resilience?: ResilienceSettings;
  /** Whether this process runs the scheduled jobs and consumes the background jobs, and the settings of the scheduled ones; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
  /** Concurrency per queue, polling interval and grace period of the worker of the background jobs; left out, one attempt at a time per queue. */
  readonly queues?: Pick<QueueWorkerOptions, 'concurrency' | 'pollIntervalMs' | 'graceMs'>;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
{{#if cache.redis}}
  /** The Redis protocol server; left out, the cache, the lock and the limiter stay in the memory of the process. */
  readonly redis?: RedisServices;
{{/if}}
{{#if files.any}}
  /** Where the content of files lives: the storage of `main.ts`; left out (the tools, the tests), the memory of the process. */
  readonly files?: FileStorage;
{{/if}}
}
