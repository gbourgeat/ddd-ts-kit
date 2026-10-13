import type { BackgroundJobOptions } from '../../application/background/background-job-options.js';
import { backgroundJobPolicy } from '../../application/background/background-job-policy.js';
import type { BackgroundJob } from '../../application/background/background-job.js';
import { InvalidJobScheduleError } from '../../application/scheduling/invalid-job-schedule-error.js';
import { isJobName } from '../../application/scheduling/is-job-name.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { record } from '../registry/record.js';

/**
 * A background job, run by a worker after a use case enqueued it, named by the static `jobName`
 * of the class: `@Background({ maxAttempts: 3, timeout: '10m' })`. The name and the options are
 * checked when the file loads.
 */
export function Background<const D extends DeclaredDependencies = DependenciesFromSignature>(
  options: BackgroundJobOptions = {},
  dependencies?: D,
): ClassDeclarator<BackgroundJob<unknown>, D> {
  return (target) => {
    const name = nameOf(target);

    try {
      backgroundJobPolicy(options);
    } catch (error) {
      throw error instanceof InvalidJobScheduleError ? new DeclarationError(`Job "${name}": ${error.message}`) : error;
    }

    record(target, { role: 'background-job', name, options, implementation: target, dependencies });
  };
}

function nameOf(target: { readonly name: string }): string {
  const name: unknown = Reflect.get(target, 'jobName');

  if (typeof name === 'string' && isJobName(name)) {
    return name;
  }

  throw new DeclarationError(
    `${target.name} has no static jobName of the form <context>.<job-name>: write static readonly jobName = 'billing.compile-statements'.`,
  );
}
