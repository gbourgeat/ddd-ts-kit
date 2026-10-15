import { CliError } from '../../cli-error.js';
import { emit } from '../emit.js';
import { givenName } from '../given-name.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { wire } from '../wire.js';
import { ensureDomainEvent } from './ensure-domain-event.js';
import { assertDeclaresItsName } from './assert-declares-its-name.js';
import { eventVars } from './event-vars.js';

export const eventHandlerKind: Kind = {
  name: 'event-handler',
  aliases: [],
  usage:
    'event-handler <context> <Aggregate> <Fact> [--phase before-commit|after-commit] [--name <Name>] [--term "<Term>=<meaning>"]...',
  summary:
    'A reaction to a domain event of the same context, its spec and its subscription: before the commit of the unit of work by default, after it with --phase after-commit, for an effect no transaction covers.',
  positionals: ['context', 'Aggregate', 'Fact'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const names = ensureDomainEvent(scope, request.args[1] ?? '', request.args[2] ?? '');

    assertDeclaresItsName(scope, names);

    const handler = givenName(scope, names.event, { what: 'event handler', suffix: ['event', 'handler'] });
    const context = { ...eventVars(scope, names), handler: { ...named(handler), ...phaseVars(scope) } };

    emit(scope, context, [
      ['event-handler/event-handler.ts.tpl', `application/event-handlers/${handler.kebab}.event-handler.ts`],
      ['event-handler/event-handler.spec.ts.tpl', `test/unit/${handler.kebab}.event-handler.spec.ts`],
    ]);

    wire(scope, 'event-handler', context);
  },
};

const PHASES = ['before-commit', 'after-commit'];

/** What the templates read of the phase: its name, and whether it is the one written out. */
function phaseVars(scope: Scope): { phase: string; afterCommit: boolean } {
  const phase = scope.flags.phase ?? 'before-commit';

  if (!PHASES.includes(phase)) {
    throw new CliError(
      `Unknown phase "${phase}".`,
      'Use --phase before-commit (the default: inside the transaction of the command, for what commits or rolls back with it) or --phase after-commit (once it has committed, at most once, for an effect no transaction covers).',
    );
  }

  return { phase, afterCommit: phase === 'after-commit' };
}
