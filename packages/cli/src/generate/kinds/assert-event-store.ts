import { CliError } from '../../cli-error';
import { CONFIG_FILE } from '../../config';
import type { Scope } from '../scope';

/** An event-sourced aggregate is loaded and saved through the stores `init --event-sourcing on` wires: without them it could not run. */
export function assertEventStore(scope: Scope): void {
  if (scope.config.stack.eventSourcing === 'on') {
    return;
  }

  throw new CliError(
    'This project has no event store (stack.eventSourcing is "off").',
    `Run \`ddd-ts-kit init --force --event-sourcing on\` to wire the event store in ${CONFIG_FILE} and src/platform/event-sourcing/ (the tables of the event_store schema, the stores, the keys of the data subjects and the cipher), then generate the aggregate again.`,
  );
}
