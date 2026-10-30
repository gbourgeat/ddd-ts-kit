import { assertPastFact, eventName, parseConceptName, toName, type Name } from '../naming';
import { CliError } from '../cli-error';
import { concept } from './concept';
import type { Scope } from './scope';

export interface EventNames {
  readonly aggregate: Name;
  readonly event: Name;
  /** What happened, alone: `Issued` of `InvoiceIssued`. */
  readonly fact: Name;
  readonly eventName: string;
}

/** The names of a domain event, from its aggregate and the fact that happened to it. */
export function eventNames(scope: Scope, aggregateInput: string, factInput: string): EventNames {
  const aggregate = concept(scope, aggregateInput, { what: 'aggregate' });

  refuseStutter(scope, aggregate, parseConceptName(factInput, 'fact', { strip: ['event'] }));

  const fact = concept(scope, factInput, { what: 'fact', strip: ['event'] });

  assertPastFact(fact, scope.flags.allowName);

  return {
    aggregate,
    event: toName(`${aggregate.words} ${fact.words}`),
    fact,
    eventName: eventName(scope.context, aggregate, fact),
  };
}

/** `Order` + `Order Confirmed` would name `OrderOrderConfirmed`: the event is named after its aggregate already. */
function refuseStutter(scope: Scope, aggregate: Name, fact: Name): void {
  if (scope.flags.allowName || !fact.words.startsWith(`${aggregate.words} `)) {
    return;
  }

  const alone = toName(fact.words.slice(aggregate.words.length + 1));

  throw new CliError(
    `"${fact.pascal}" starts with the aggregate ${aggregate.pascal}: the event would be named ${aggregate.pascal}${fact.pascal}.`,
    `Give the fact alone, "${alone.pascal}" (the event is named ${aggregate.pascal}${alone.pascal}), or pass --allow-name if the name is right.`,
  );
}
