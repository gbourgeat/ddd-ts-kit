import { wordsOf } from './words-of';

/**
 * The words of the fact an event names, after the name of its aggregate: `InvoiceIssued` of
 * `Invoice` is `issued`. The whole name when it does not start with the name of an aggregate.
 */
export function factWords(eventName: string, aggregates: readonly string[]): string[] {
  const owner = aggregates.find(
    (aggregate) => eventName.startsWith(aggregate) && /^[A-Z]/.test(eventName.slice(aggregate.length)),
  );

  return wordsOf(owner === undefined ? eventName : eventName.slice(owner.length));
}
