/** The singular of a plural English word (`reminders`, `deliveries`, `boxes`), or undefined when it does not read as one. */
export function singular(word: string): string | undefined {
  if (/[^aeiou]ies$/.test(word)) {
    return `${word.slice(0, -3)}y`;
  }

  if (/(?:ss|x|z|ch|sh)es$/.test(word)) {
    return word.slice(0, -2);
  }

  return /[^su]s$/.test(word) ? word.slice(0, -1) : undefined;
}
