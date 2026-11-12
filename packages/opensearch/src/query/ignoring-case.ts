/** What means something in a regular expression of Lucene, every optional operator included. */
const RESERVED = /[.?+*|{}[\]()"\\#@&<>~]/g;

/**
 * A text as a regular expression of Lucene that finds it whatever the case: each letter is the
 * class of its lower-case and upper-case forms (`[éÉ]`), and every other character matches
 * itself. The `case_insensitive` parameter of a query folds the ASCII letters alone, so the forms
 * are written here, from the tables of JavaScript, which is what `foldCase` of the kernel reads.
 * A form longer than one character (`SS` for `ß`) is left out: the letter then finds itself only.
 */
export function ignoringCase(text: string): string {
  return Array.from(text, eitherCase).join('');
}

function eitherCase(character: string): string {
  const forms = [character.toLowerCase(), character.toUpperCase()].filter((form) => Array.from(form).length === 1);
  const letters = [...new Set([character, ...forms])];

  return letters.length === 1 ? character.replace(RESERVED, '\\$&') : `[${letters.join('')}]`;
}
