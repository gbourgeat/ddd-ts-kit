import { CliError } from '../../../cli-error';
import type { Scope } from '../../scope';

/**
 * Background jobs and process managers run in the worker the kernel module of `@ddd-ts-kit/di`
 * builds: `what` cannot be generated on another container, which would write it unregistered.
 */
export function requireContainer(scope: Scope, what: string): void {
  const { di } = scope.config.stack;

  if (di === 'tsyringe') {
    return;
  }

  throw new CliError(
    `A ${what} cannot be generated with --di ${di}.`,
    'The queue, its worker and the process runner are bound by the kernel module of @ddd-ts-kit/di (--di tsyringe). With another container, write the class by hand and register it with the QueueWorker of @ddd-ts-kit/scheduling where the platform builds it.',
  );
}
