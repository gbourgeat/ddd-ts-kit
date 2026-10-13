import { isPastParticiple } from './is-past-participle.js';

/**
 * Past participles spelled like the imperative of their verb: at the head of a name they read as
 * a command (`SetPrice`, `ReadInvoice`, `RunReport`), after a noun as a fact (`PriceSet`). The
 * same list as the generator and the checker of the CLI, held equal by a test of the CLI.
 */
const READS_AS_COMMAND = new Set([
  ...['bid', 'bound', 'cast', 'come', 'become', 'cut', 'forecast', 'found', 'hit', 'left', 'put'],
  ...['quit', 'read', 'rerun', 'reset', 'run', 'set', 'shed', 'shut', 'split', 'spread'],
]);

/** Whether the words of the fact of an event, its name after its aggregate, read as something that happened. */
export function isPastFact(words: readonly string[]): boolean {
  return words.some(
    (word, index) => isPastParticiple(word) && !(index === 0 && READS_AS_COMMAND.has(word.toLowerCase())),
  );
}
