import { CliError } from '../../cli-error';
import type { EventNames } from '../event-names';
import { isDeclared } from '../is-declared';
import type { Scope } from '../scope';
import { declaresItsName } from './declares-its-name';
import { eventFileOf } from './event-file-of';

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
    `In ${eventFileOf(scope, names)}, extend \`NamedDomainEvent('${names.eventName}')\` (or write \`static readonly eventName = '${names.eventName}';\` and \`readonly name = ${names.event.pascal}.eventName;\`), then run the command again.`,
  );
}
