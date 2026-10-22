import { backgroundJobPolicy, isJobName, type BackgroundJob, type BackgroundJobOptions } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error';
import type { BackgroundJobRegistration } from '../wiring/background-job-registration';
import { readable } from './readable';

interface Located {
  readonly module: string;
  readonly job: Token<BackgroundJob<unknown>>;
}

/**
 * The background job of an explicit module. The name is how a use case enqueues it, from the
 * static `jobName` of the class: a class that names itself otherwise would never be run.
 */
export function writtenBackgroundJob(
  name: string,
  options: BackgroundJobOptions,
  located: Located,
): BackgroundJobRegistration {
  const declared: unknown = Reflect.get(located.job, 'jobName');

  if (!isJobName(name) || (declared !== undefined && declared !== name)) {
    throw new WiringError(
      'INVALID_JOB_SETTINGS',
      `backgroundJob(${name}) in module "${located.module}": the name is <context>.<job-name> and is the static jobName of the class.`,
    );
  }

  readable(name, () => backgroundJobPolicy(options));

  return { name, options, ...located };
}
