import { CliError } from '../cli-error';
import { looksLikePastFact } from './looks-like-past-fact';
import type { Name } from './name';

export function assertPastFact(fact: Name, allowName: boolean): void {
  if (allowName || looksLikePastFact(fact)) {
    return;
  }

  throw new CliError(
    `"${fact.pascal}" does not read as something that happened.`,
    'Name the event as a fact in the past tense (Issued, Paid, MarkedAsOverdue), or pass --allow-name if the term is right.',
  );
}
