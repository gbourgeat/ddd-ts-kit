import { parseConceptName, toName, type Name } from '../../naming';
import { eventNames, type EventNames } from '../event-names';
import type { Scope } from '../scope';

/**
 * The names of the event an aggregate is born with, from the fact `--birth` gives in business
 * words: `Issued`, `Invoice Issued` and `InvoiceIssued` all name `InvoiceIssued` of `Invoice`. The
 * words of the aggregate the fact starts with are its subject, not the fact; the rest is judged as
 * the fact of any domain event (past tense, glossary).
 */
export function birthNames(scope: Scope, aggregate: Name, input: string): EventNames {
  const typed = parseConceptName(input, 'fact', { strip: ['event'] });

  return eventNames(scope, aggregate.pascal, withoutSubject(typed, aggregate).pascal);
}

function withoutSubject(fact: Name, aggregate: Name): Name {
  const subject = `${aggregate.words} `;

  return fact.words.startsWith(subject) ? toName(fact.words.slice(subject.length)) : fact;
}
