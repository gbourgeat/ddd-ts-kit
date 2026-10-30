import { eventName, toName, type Name } from '../../naming';
import { filesUnder } from '../files-under';
import type { Scope } from '../scope';
import type { Birth } from './birth';
import { birthOf } from './birth-of';

/** The aggregate a handler gives birth to: `Invoice.create(`. */
const CREATED = /\b([A-Z][A-Za-z0-9]*)\.create\(/;
const DECLARED_NAME = /NamedDomainEvent\('([^']+)'\)/;

/**
 * The spans the birth of the aggregate a handler creates leaves after its save, as the trace of
 * the request shows them: `unit-of-work before-commit`, then `domain-event <name>`. Empty when the
 * handler creates nothing or the aggregate records no birth. The reactions to that event are the
 * team's to add: a note names the files that already react to it.
 */
export function birthSpan(scope: Scope, handler: string): string {
  const created = CREATED.exec(handler)?.[1];

  if (created === undefined) {
    return '';
  }

  const aggregate = toName(created);
  const read = birthOf(scope, aggregate);

  if ('unreadable' in read || read.birth === undefined) {
    return '';
  }

  noteReactions(scope, read.birth);

  return `, { name: 'unit-of-work before-commit', children: [{ name: 'domain-event ${nameOf(scope, aggregate, read.birth)}' }] }`;
}

/** The name the event declares, else the one the generator gives it. */
function nameOf(scope: Scope, aggregate: Name, birth: Birth): string {
  const event = scope.ws.read(`${scope.dir}/domain/events/${birth.event.kebab}.event.ts`) ?? '';

  return DECLARED_NAME.exec(event)?.[1] ?? eventName(scope.context, aggregate, birth.fact);
}

function noteReactions(scope: Scope, birth: Birth): void {
  const application = `${scope.dir}/application`;

  const reacting = filesUnder(scope.ws, application).filter(
    (file) =>
      !file.includes('/commands/') &&
      new RegExp(`\\b${birth.event.pascal}\\b`).test(scope.ws.read(`${application}/${file}`) ?? ''),
  );

  if (reacting.length > 0) {
    scope.ws.note(
      `The trace the end-to-end spec expects stops at \`domain-event\` of ${birth.event.pascal}: add under it the spans of what reacts to it (${reacting.join(', ')}), \`handler <Class>\`, then \`outbox append <type>\` for a publisher.`,
    );
  }
}
