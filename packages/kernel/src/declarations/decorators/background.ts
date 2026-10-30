import type { BackgroundJobOptions } from '../../application/background/background-job-options';
import { backgroundJobPolicy } from '../../application/background/background-job-policy';
import type { BackgroundJobPayloadSchema } from '../../application/background/background-job-payload-schema';
import type { BackgroundJob } from '../../application/background/background-job';
import { InvalidJobScheduleError } from '../../application/scheduling/invalid-job-schedule-error';
import { isJobName } from '../../application/scheduling/is-job-name';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import { DeclarationError } from '../registry/declaration-error';
import { record } from '../registry/record';

/** What a background job class carries next to its constructor: the schema of its payload. */
interface PayloadDeclared {
  readonly payload: BackgroundJobPayloadSchema<unknown>;
}

/**
 * A background job, run by a worker after a use case enqueued it, named by the static `jobName`
 * of the class and reading its stored payload with its static `payload` schema:
 * `@Background({ maxAttempts: 3, timeout: '10m' })`. The name, the schema and the options are
 * checked when the file loads. Under standard decorators a class decorator runs before the
 * static fields exist: the job is then recorded once the class is defined.
 */
export function Background<const D extends DeclaredDependencies = DependenciesFromSignature>(
  options: BackgroundJobOptions = {},
  dependencies?: D,
): ClassDeclarator<BackgroundJob<unknown>, D, PayloadDeclared> {
  return (target, context) => {
    const declare = (): void => {
      const name = nameOf(target);
      const payload = payloadOf(target, name);

      try {
        backgroundJobPolicy(options);
      } catch (error) {
        throw error instanceof InvalidJobScheduleError
          ? new DeclarationError(`Job "${name}": ${error.message}`)
          : error;
      }

      record(target, { role: 'background-job', name, options, payload, implementation: target, dependencies });
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

function payloadOf(target: object, name: string): BackgroundJobPayloadSchema<unknown> {
  const payload: unknown = Reflect.get(target, 'payload');

  if (isPayloadSchema(payload)) {
    return payload;
  }

  throw new DeclarationError(
    `Job "${name}" has no static payload schema: write static readonly payload = <the schema of its payload>, which the worker reads the stored payload with before each run.`,
  );
}

function isPayloadSchema(value: unknown): value is BackgroundJobPayloadSchema<unknown> {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'parse') === 'function';
}
