import { eventNames } from '../event-names.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { openScope } from '../open-scope.js';
import { writeDomainEvent } from './write-domain-event.js';

export const domainEventKind: Kind = {
  name: 'domain-event',
  aliases: [],
  usage: 'domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...',
  summary: 'A domain event named <context>.<aggregate>.<fact>, and its spec.',
  positionals: ['context', 'Aggregate', 'Fact'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);
    writeDomainEvent(scope, eventNames(scope, request.args[1] ?? '', request.args[2] ?? ''));
  },
};
