import { wordsOfName } from './words-of-name';

/** The term of the vocabulary a name holds (its words contain those of the term, in a row), or undefined. */
export function personalTermOf(name: string, vocabulary: readonly string[]): string | undefined {
  const words = wordsOfName(name);

  return vocabulary.find((term) => {
    const wanted = wordsOfName(term);

    return words.some((_, start) => wanted.every((word, offset) => words[start + offset] === word));
  });
}
