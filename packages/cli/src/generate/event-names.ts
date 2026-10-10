import { assertPastFact, eventName, toName, type Name } from '../naming/index.js';
import { concept } from './concept.js';
import type { Scope } from './scope.js';

export interface EventNames {
  readonly aggregate: Name;
  readonly event: Name;
  readonly eventName: string;
}

/** The names of a domain event, from its aggregate and the fact that happened to it. */
export function eventNames(scope: Scope, aggregateInput: string, factInput: string): EventNames {
  const aggregate = concept(scope, aggregateInput, { what: 'aggregate' });
  const fact = concept(scope, factInput, { what: 'fact', strip: ['event'] });

  assertPastFact(fact, scope.flags.allowName);

  return { aggregate, event: toName(`${aggregate.words} ${fact.words}`), eventName: eventName(scope.context, aggregate, fact) };
}
