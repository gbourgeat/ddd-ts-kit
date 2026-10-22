import { CliError } from '../cli-error';
import { capitalize } from './capitalize';
import type { Name } from './name';
import { splitWords } from './split-words';
import { toName } from './to-name';

const VAGUE_SUFFIXES = ['manager', 'helper', 'util', 'utils', 'data', 'info'];

export interface NameOptions {
  readonly allowName: boolean;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
}

/** The name of a concept as the caller typed it: well formed, without the role suffix, and not a technical bucket. */
export function parseConceptName(input: string, what: string, options: NameOptions): Name {
  if (!/^[A-Za-z][A-Za-z0-9_\- ]*$/.test(input)) {
    throw new CliError(
      `"${input}" is not a valid ${what} name.`,
      'Use letters and digits only, starting with a letter, for example InvoiceLine or invoice-line.',
    );
  }

  const words = withoutRole(splitWords(input), options.strip ?? []);
  const tail = words.at(-1);

  if (!options.allowName && tail !== undefined && VAGUE_SUFFIXES.includes(tail)) {
    throw new CliError(
      `"${input}" ends with "${capitalize(tail)}", which names a technical bucket, not a concept.`,
      'Use a term of the ubiquitous language (what a domain expert would call it), or pass --allow-name if this really is the business term.',
    );
  }

  return toName(words.join(' '));
}

function withoutRole(words: readonly string[], roles: readonly string[]): readonly string[] {
  const last = words.at(-1);

  return words.length > 1 && last !== undefined && roles.includes(last) ? words.slice(0, -1) : words;
}
