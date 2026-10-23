import type { BackgroundJobOptions } from '../../application/background/background-job-options';
import { backgroundJobPolicy } from '../../application/background/background-job-policy';
import type { BackgroundJob } from '../../application/background/background-job';
import { InvalidJobScheduleError } from '../../application/scheduling/invalid-job-schedule-error';
import { isJobName } from '../../application/scheduling/is-job-name';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import { DeclarationError } from '../registry/declaration-error';
import { record } from '../registry/record';

/**
 * A background job, run by a worker after a use case enqueued it, named by the static `jobName`
 * of the class: `@Background({ maxAttempts: 3, timeout: '10m' })`. The name and the options are
 * checked when the file loads. Under standard decorators a class decorator runs before the
 * static fields exist: the job is then recorded once the class is defined.
 */
export function Background<const D extends DeclaredDependencies = DependenciesFromSignature>(
  options: BackgroundJobOptions = {},
  dependencies?: D,
): ClassDeclarator<BackgroundJob<unknown>, D> {
  return (target, context) => {
    const declare = (): void => {
      const name = nameOf(target);

      try {
        backgroundJobPolicy(options);
      } catch (error) {
        throw error instanceof InvalidJobScheduleError
          ? new DeclarationError(`Job "${name}": ${error.message}`)
          : error;
      }

      record(target, { role: 'background-job', name, options, implementation: target, dependencies });
    };

    if (context === undefined) {
      declare();
    } else {
      context.addInitializer(declare);
    }
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
