/** The last words that name several things already, or a mass: the table is named as they are (`reader_settings`). */
const ALREADY_PLURAL =
  /^(?:settings|preferences|news|series|species|data|metadata|analytics|statistics|logistics|economics)$/;

/** The plural of an English word, as the generator writes table names: `purchase_orders`, `deliveries`. */
export function plural(word: string): string {
  if (ALREADY_PLURAL.test(word)) {
    return word;
  }

  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  return /(?:s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}
