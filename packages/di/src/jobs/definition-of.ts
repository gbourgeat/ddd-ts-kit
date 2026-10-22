import type { JobDefinition } from '@ddd-ts-kit/kernel';
import type { Instrumentation } from '../kernel/instrumentation';
import type { Resolve } from '../wiring/resolve';
import type { EffectiveJob } from './effective-job';

/** What a scheduler is given: the job is built on its first run, so a job that cannot be built fails that run. */
export function definitionOf(job: EffectiveJob, resolve: Resolve, instrument?: Instrumentation['job']): JobDefinition {
  const run: JobDefinition['run'] = async (execution) => resolve(job.job).run(execution);

  return {
    name: job.name,
    schedule: job.schedule,
    ...job.policy,
    run: instrument === undefined ? run : instrument(run, { name: job.name, context: job.module }),
  };
}
