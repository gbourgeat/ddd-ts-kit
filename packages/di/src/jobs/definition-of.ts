import type { JobDefinition } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve.js';
import type { EffectiveJob } from './effective-job.js';

/** What a scheduler is given: the job is built on its first run, so a job that cannot be built fails that run. */
export function definitionOf(job: EffectiveJob, resolve: Resolve): JobDefinition {
  return {
    name: job.name,
    schedule: job.schedule,
    ...job.policy,
    run: async (execution) => resolve(job.job).run(execution),
  };
}
