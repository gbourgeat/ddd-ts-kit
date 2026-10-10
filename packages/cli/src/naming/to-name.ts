import { capitalize } from './capitalize.js';
import type { Name } from './name.js';
import { splitWords } from './split-words.js';

export function toName(input: string): Name {
  const words = splitWords(input);
  const pascal = words.map(capitalize).join('');
  const plural = [...words.slice(0, -1), pluralize(words.at(-1) ?? '')];

  return {
    pascal,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
    kebab: words.join('-'),
    constant: words.join('_').toUpperCase(),
    words: words.join(' '),
    title: capitalize(words.join(' ')),
    article: /^[aeiou]/.test(words[0] ?? '') ? 'an' : 'a',
    table: plural.join('_'),
    tableCamel: plural.map((word, index) => (index === 0 ? word : capitalize(word))).join(''),
  };
}

function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;

  return /(?:s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}
