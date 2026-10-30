import { CliError } from '../../cli-error';
import { CONFIG_FILE, isControlPlane } from '../../config';
import type { Scope } from '../scope';

/**
 * An event-sourced aggregate is loaded and saved through the stores `init --event-sourcing on` wires:
 * without them it could not run. In a multi-tenant project a stream belongs to a tenant, so the
 * control plane of the tenants, whose data belongs to none, keeps its state in tables.
 */
export function assertEventStore(scope: Scope): void {
  if (scope.config.stack.eventSourcing !== 'on') {
    throw new CliError(
      'This project has no event store (stack.eventSourcing is "off").',
      `Run \`ddd-ts-kit init --force --event-sourcing on\` to wire the event store in ${CONFIG_FILE} and src/platform/event-sourcing/ (the tables of the event_store schema, the stores, the keys of the data subjects and the cipher), then generate the aggregate again.`,
    );
  }

  if (scope.config.stack.tenancy !== 'none' && isControlPlane(scope.config, scope.context.kebab)) {
    throw new CliError(
      `${scope.context.kebab} is the control plane of the tenants: its data belongs to no tenant, and every stream of the event store belongs to one.`,
      'Generate the aggregate without --event-sourced: its state stays in a table of the context, which work in no tenant reaches.',
    );
  }
}
