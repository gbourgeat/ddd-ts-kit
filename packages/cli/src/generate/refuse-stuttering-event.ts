import { CliError } from '../cli-error';
import { toName } from '../naming';
import type { EventNames } from './event-names';
import type { Scope } from './scope';

/**
 * `Order` + `Order Confirmed` would name `OrderOrderConfirmed`: the event is named after its aggregate already.
 * Asked where an event is created; a reference to an event that exists is never refused.
 */
export function refuseStutteringEvent(scope: Scope, { aggregate, fact }: EventNames): void {
  if (scope.flags.allowName || !fact.words.startsWith(`${aggregate.words} `)) {
    return;
  }

  const alone = toName(fact.words.slice(aggregate.words.length + 1));

  throw new CliError(
    `"${fact.pascal}" starts with the aggregate ${aggregate.pascal}: the event would be named ${aggregate.pascal}${fact.pascal}.`,
    `Give the fact alone, "${alone.pascal}" (the event is named ${aggregate.pascal}${alone.pascal}), or pass --allow-name if the name is right.`,
  );
}
