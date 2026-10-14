import { CliError } from '../../cli-error.js';
import type { EventNames } from '../event-names.js';
import { isDeclared } from '../is-declared.js';
import type { Scope } from '../scope.js';
import { declaresItsName } from './declares-its-name.js';
import { eventFileOf } from './event-file-of.js';

/**
 * In the declared style a reaction is attached under the name its event class declares,
 * `@DomainEventHandler(InvoiceIssued)`: an event class generated before 0.7 has to declare it
 * first, or the reaction does not compile.
 */
export function assertDeclaresItsName(scope: Scope, names: EventNames): void {
  if (!isDeclared(scope.config) || declaresItsName(scope, names)) {
    return;
  }

  throw new CliError(
    `${names.event.pascal} does not declare the name its events carry, and a declared reaction is attached under it.`,
    `In ${eventFileOf(scope, names)}, write \`static readonly eventName = '${names.eventName}';\` and \`readonly name = ${names.event.pascal}.eventName;\`, then run the command again.`,
  );
}
