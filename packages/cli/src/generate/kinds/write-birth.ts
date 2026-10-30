import type { EventNames } from '../event-names';
import type { Scope } from '../scope';
import { writeDomainEvent } from './write-domain-event';

/** The event of the birth belongs to the aggregate that records it: an aggregate that was kept does not record this one. */
export function writeBirth(scope: Scope, birth: EventNames, written: boolean): void {
  if (written) {
    writeDomainEvent(scope, birth);

    return;
  }

  scope.ws.note(
    `--birth ${birth.fact.pascal} applies to a new aggregate: ${birth.aggregate.pascal} was kept as it is, so ${birth.event.pascal} is not written. Add the event to the aggregate with \`ddd-ts-kit generate domain-event ${scope.context.kebab} ${birth.aggregate.pascal} ${birth.fact.pascal}\` and record it by hand, or replace the aggregate with --force.`,
  );
}
