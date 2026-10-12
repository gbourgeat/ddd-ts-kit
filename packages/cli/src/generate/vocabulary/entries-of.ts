import { CliError } from '../../cli-error.js';
import { toName } from '../../naming/index.js';
import type { VocabularyEntry } from './vocabulary-entry.js';

const VALUE = /^[A-Za-z0-9][A-Za-z0-9 _.:/-]*$/;

/** The entries of the values asked for, each keyed by its value in PascalCase; a value that has no key, or two values under one key, are refused. */
export function entriesOf(values: readonly string[]): VocabularyEntry[] {
  const entries = [...new Set(values)].map((value) => {
    if (!VALUE.test(value)) {
      throw new CliError(
        `"${value}" cannot be a value of a vocabulary.`,
        'Pass each value with --value, starting with a letter or a digit, without quotes: --value requested --value no-show.',
      );
    }

    return { key: toName(value).pascal, value };
  });

  const clash = entries.find((entry, index) => entries.findIndex((other) => other.key === entry.key) !== index);

  if (clash !== undefined) {
    throw new CliError(
      `Two values would be read as ${clash.key}.`,
      'Give the values of a vocabulary distinct words: the key of each is its value in PascalCase.',
    );
  }

  return entries;
}
