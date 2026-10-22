import { splitWords } from '../naming';

/** The longest aggregate name the words of a class per error start or end with; empty when none. */
export function conceptNamed(className: string, aggregates: readonly string[]): string {
  const words = splitWords(className.replace(/Error$/, '')).join(' ');

  const named = aggregates
    .filter((aggregate) => {
      const subject = splitWords(aggregate).join(' ');

      return words === subject || words.startsWith(`${subject} `) || words.endsWith(` ${subject}`);
    })
    .sort((a, b) => b.length - a.length);

  return named[0] ?? '';
}
