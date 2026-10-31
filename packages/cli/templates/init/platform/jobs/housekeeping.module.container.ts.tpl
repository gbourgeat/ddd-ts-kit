import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
{{#if events.outbox}}
import { OutboxStore } from '@ddd-ts-kit/events';
{{/if}}
import { Clock } from '@ddd-ts-kit/kernel';
{{#if queue.stored}}
import { JobStore } from '@ddd-ts-kit/scheduling';
{{/if}}
import { daysBefore } from '{{alias.platform}}/jobs/days-before{{alias.ext}}';
import type { Housekeeping } from '{{alias.platform}}/jobs/housekeeping{{alias.ext}}';

/**
 * What the platform is done with, purged every night{{#if events.outbox}}: `events.purge-published` at 03:30 UTC (switched off in
 * one environment with `JOB_EVENTS_PURGE_PUBLISHED_ENABLED=false`){{/if}}{{#if queue.stored}}{{#if events.outbox}},{{/if}}{{#unless events.outbox}}:{{/unless}} `jobs.purge-finished` at 03:45 UTC
 * (`JOB_JOBS_PURGE_FINISHED_ENABLED=false`){{/if}}. A record and a job row keep their payload until then.
 */
export function housekeepingModule(
  retention: Housekeeping,
  { jobs = true }: { readonly jobs?: boolean } = {},
): ContextModule {
  return defineContextModule({
    name: 'housekeeping',
    register(builder) {
      // Registered by the process that runs the jobs of the platform; a service of the deployment passes `jobs: false`.
      if (!jobs) {
        return;
      }
{{#if events.outbox}}

      builder.job('events.purge-published', { cron: '30 3 * * *', tenancy: 'global' }).handledByFactory((resolve) => ({
        run: async () => {
          await resolve(OutboxStore).purgePublished(daysBefore(resolve(Clock), retention.publishedEventsDays));
        },
      }));
{{/if}}
{{#if queue.stored}}

      builder.job('jobs.purge-finished', { cron: '45 3 * * *', tenancy: 'global' }).handledByFactory((resolve) => ({
        run: async () => {
          await resolve(JobStore).purgeFinished(daysBefore(resolve(Clock), retention.finishedJobsDays));
        },
      }));
{{/if}}
    },
  });
}
