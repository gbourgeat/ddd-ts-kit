import { eventNames } from '../event-names.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { openScope } from '../open-scope.js';
import { extendEventSourcedAggregate } from './extend-event-sourced-aggregate.js';
import { writeDomainEvent } from './write-domain-event.js';

export const domainEventKind: Kind = {
  name: 'domain-event',
  aliases: [],
  usage: 'domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...',
  summary:
    'A domain event named <context>.<aggregate>.<fact>, and its spec; for an event-sourced aggregate, its apply method and its stored form too.',
  positionals: ['context', 'Aggregate', 'Fact'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);
    const names = eventNames(scope, request.args[1] ?? '', request.args[2] ?? '');

    writeDomainEvent(scope, names);
    extendEventSourcedAggregate(scope, names);
  },
};
