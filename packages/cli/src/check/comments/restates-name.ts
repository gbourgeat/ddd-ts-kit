import { splitWords } from '../../naming/index.js';
import { sameWord } from '../language/same-word.js';

/** Words that add nothing to the name they sit next to. */
const FILLER = new Set(['the', 'a', 'an', 'of', 'this', 'that', 'for', 'to', 'is', 'it', 'its', 'new', 'given', 'current', 'class', 'function', 'method', 'property', 'field', 'constructor', 'instance', 'object', 'value', 'get', 'set', 'return', 'create', 'represent', 'define', 'implementation', 'interface', 'type']);

/** True when the description says nothing the name does not already say. */
export function restatesName(description: string, name: string): boolean {
  const said = splitWords(description.replace(/[.`'"]/g, ' '));

  if (said.length === 0 || said.length > 8) return false;

  const named = splitWords(name);

  return said.every((word) => FILLER.has(word) || [...FILLER].some((filler) => sameWord(filler, word)) || named.some((part) => sameWord(part, word)));
}
