import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { openScope } from '../open-scope.js';
import { wire } from '../wire.js';
import { ensureDomainEvent } from './ensure-domain-event.js';
import { eventVars } from './event-vars.js';

export const eventHandlerKind: Kind = {
  name: 'event-handler',
  aliases: [],
  usage: 'event-handler <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...',
  summary: 'A reaction to a domain event of the same context, its spec and its subscription.',
  positionals: ['context', 'Aggregate', 'Fact'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const names = ensureDomainEvent(scope, request.args[1] ?? '', request.args[2] ?? '');
    const context = eventVars(scope, names);

    emit(scope, context, [
      ['event-handler/event-handler.ts.tpl', `application/event-handlers/${names.event.kebab}.event-handler.ts`],
      ['event-handler/event-handler.spec.ts.tpl', `test/unit/${names.event.kebab}.event-handler.spec.ts`],
    ]);

    wire(scope, 'event-handler', context);
  },
};
