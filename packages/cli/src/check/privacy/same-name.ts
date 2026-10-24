import { wordsOfName } from './words-of-name';

/** One name in two spellings: `customer_email` and `customerEmail` are the same column. */
export function sameName(left: string, right: string): boolean {
  return wordsOfName(left).join('_') === wordsOfName(right).join('_');
}
