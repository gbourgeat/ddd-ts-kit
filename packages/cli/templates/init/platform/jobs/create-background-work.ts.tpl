{{#if queue.processTable}}
import type { CommandBus, JobQueue, ProcessRunner } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless queue.processTable}}
import { InMemoryProcessStore, type CommandBus, type JobQueue, type ProcessRunner } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if queue.database}}
{{#if errors.sentry}}
import {
  QueueWorker,
  StoredJobQueue,
  StoredProcessRunner,
  reportFailedBackgroundJobs,
  type JobStore,
} from '@ddd-ts-kit/scheduling';
{{/if}}
{{#unless errors.sentry}}
import { QueueWorker, StoredJobQueue, StoredProcessRunner, type JobStore } from '@ddd-ts-kit/scheduling';
{{/unless}}
{{/if}}
{{#unless queue.database}}
import {
  InMemoryJobStore,
  QueueWorker,
  StoredJobQueue,
  StoredProcessRunner,
{{#if errors.sentry}}
  reportFailedBackgroundJobs,
{{/if}}
  type JobStore,
} from '@ddd-ts-kit/scheduling';
{{/unless}}
import type { TracedApplication } from '@ddd-ts-kit/tracing';
import type { Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
import type { PlatformOptions } from '{{alias.platform}}/composition/platform-options{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import type { BackgroundJobs } from '{{alias.platform}}/jobs/background-jobs{{alias.ext}}';

/** The queue a use case enqueues through, the worker that consumes it and the runner of the process managers. */
export interface BackgroundWork {
  /** What a use case enqueues through, in the transaction of its command when the store shares it. */
  readonly jobQueue: JobQueue;
{{#if queue.stored}}
  /** Where the jobs wait: what the purge of what finished and the erasure of a person reach. */
  readonly jobStore: JobStore;
{{/if}}
  readonly backgroundJobs: BackgroundJobs;
  /** Runs the steps of the process managers and delivers their timeouts. */
  readonly processes: ProcessRunner;
}

interface BackgroundWorkParts {
  readonly persistence: Persistence;
  readonly options: PlatformOptions;
  readonly foundations: Foundations;
  /** The bus the runner of the process managers sends the commands of a step on. */
  readonly commands: CommandBus;
}

/**
 * The background work of the platform on one job store{{#if queue.database}}: the jobs table of the persistence, so a job
 * enqueued by a command exists if and only if the command committed{{/if}}{{#if queue.redis}}: the server of the cache, written
 * once the command committed; left out (the tools, the tests), the memory of the process{{/if}}{{#if queue.memory}}: the memory of
 * the process, seen by no other process and lost when it restarts (`init --force --queue database`
 * moves it to the database){{/if}}. A job carries the correlation, the actor, the tenant and the trace of the
 * work that enqueued it; the worker runs each attempt in that scope.
 */
export function createBackgroundWork({
  persistence,
  options,
  foundations,
  commands,
}: BackgroundWorkParts): BackgroundWork {
  const { traced, clock, ids, scope } = foundations;
{{#if queue.database}}
  const store = persistence.jobs;
{{/if}}
{{#if queue.redis}}
{{#if errors.sentry}}
  const store = options.redis?.jobs(foundations.logger, foundations.errors) ?? new InMemoryJobStore();
{{/if}}
{{#unless errors.sentry}}
  const store = options.redis?.jobs(foundations.logger) ?? new InMemoryJobStore();
{{/unless}}
{{/if}}
{{#if queue.memory}}
  const store = new InMemoryJobStore();
{{/if}}
  const jobQueue = new StoredJobQueue({ store, clock, ids, scope, traceparent: traced.traceparent });

  return {
    jobQueue,
{{#if queue.stored}}
    jobStore: store,
{{/if}}
    backgroundJobs: backgroundJobsOn(workerOn(store, options, foundations), traced),
    processes: new StoredProcessRunner({
{{#if queue.processTable}}
      // The instances of the process managers, saved in the transaction of each step.
      store: persistence.processes(scope),
{{/if}}
{{#unless queue.processTable}}
      // The instances of the process managers, in the memory of the process: the process store of the ORM package keeps them with the steps.
      store: new InMemoryProcessStore(),
{{/unless}}
      jobs: jobQueue,
      commands,
      unitOfWork: persistence.unitOfWork,
    }),
  };
}

/** The worker of the store, tuned by `queues`{{#if errors.sentry}}; an attempt that failed, retried or not, is reported with the id of the trace it ran in{{/if}}. */
function workerOn(store: JobStore, options: PlatformOptions, foundations: Foundations): QueueWorker {
  const { clock, scope, logger, metrics } = foundations;

  return new QueueWorker({
    ...options.queues,
    store,
    clock,
    scope,
    logger,
    metrics,
{{#if errors.sentry}}
    onRun: reportFailedBackgroundJobs(foundations.errors),
{{/if}}
  });
}

/** Each attempt observed from outside (its span), named after the job and its context. */
function backgroundJobsOn(worker: QueueWorker, traced: TracedApplication): BackgroundJobs {
  return {
    register: (job, deps, options) => {
      const { jobName: name } = job;
      const built = new job(...deps);

      worker.register({
        name,
        payload: job.payload,
        ...(options === undefined ? {} : { options }),
        run: traced.backgroundJob((payload, execution) => built.run(payload, execution), {
          name,
          context: contextOf(name),
        }),
      });
    },
    start: () => worker.start(),
    stop: () => worker.stop(),
  };
}

/** A background job is named `<context>.<job>`. */
function contextOf(jobName: string): string {
  return jobName.split('.')[0] ?? jobName;
}
