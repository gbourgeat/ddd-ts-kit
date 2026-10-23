import { CliError } from '../../cli-error';
import { toName } from '../../naming';
import type { VocabularyEntry } from './vocabulary-entry';

const VALUE = /^[A-Za-z][A-Za-z0-9 _.:/-]*$/;
const KEY = /^[A-Za-z][\w$]*$/;

/** The entries of the values asked for, each keyed by its value in PascalCase; a value whose key would not be an identifier (`1`, `o'clock`), or two values under one key, are refused. */
export function entriesOf(values: readonly string[]): VocabularyEntry[] {
  const entries = [...new Set(values)].map((value) => {
    if (!VALUE.test(value) || !KEY.test(toName(value).pascal)) {
      throw new CliError(
        `"${value}" cannot be a value of a vocabulary.`,
        'Pass each value with --value, starting with a letter, without quotes: --value requested --value no-show. The key of each is its value in PascalCase, and a key starts with a letter.',
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
