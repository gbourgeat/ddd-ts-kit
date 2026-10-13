import { isPastWord } from './is-past-word.js';

/**
 * Past participles spelled like the imperative of their verb: at the head of a name they read as
 * a command (`SetPrice`, `ReadInvoice`, `RunReport`), after a noun as a fact (`PriceSet`).
 */
const READS_AS_COMMAND = new Set([
  ...['bid', 'bound', 'cast', 'come', 'become', 'cut', 'forecast', 'found', 'hit', 'left', 'put'],
  ...['quit', 'read', 'rerun', 'reset', 'run', 'set', 'shed', 'shut', 'split', 'spread'],
]);

/**
 * Pragmatic: whether the words of the fact of an event, its name after its aggregate, read as
 * something that happened: one of them is a past participle, and not a word that reads as a
 * command at the head. Not a grammar.
 */
export function isPastFact(words: readonly string[]): boolean {
  return words.some((word, index) => isPastWord(word) && !(index === 0 && READS_AS_COMMAND.has(word.toLowerCase())));
}
