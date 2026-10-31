import { CliError } from '../cli-error';
import type { Name } from './name';
import { refuseWindowsReserved } from './refuse-windows-reserved';
import { splitWords } from './split-words';
import { toName } from './to-name';

export interface NameOptions {
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
  /** `--allow-name`: a name Windows reserves for a device is let through. */
  readonly allowReserved?: boolean;
}

/**
 * The name of a concept as the caller typed it: well formed and without the role suffix. Whether
 * its words are technical or terms of the glossary is judged against the context by the generator.
 */
export function parseConceptName(input: string, what: string, options: NameOptions = {}): Name {
  if (!/^[A-Za-z][A-Za-z0-9_\- ]*$/.test(input)) {
    throw new CliError(
      `"${input}" is not a valid ${what} name.`,
      'Use letters and digits only, starting with a letter, for example InvoiceLine or invoice-line.',
    );
  }

  const name = toName(withoutRole(splitWords(input), options.strip ?? []).join(' '));

  refuseWindowsReserved(name, what, options.allowReserved);

  return name;
}

function withoutRole(words: readonly string[], roles: readonly string[]): readonly string[] {
  const last = words.at(-1);

  return words.length > 1 && last !== undefined && roles.includes(last) ? words.slice(0, -1) : words;
}
