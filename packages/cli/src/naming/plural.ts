/** The plural of an English word, as the generator writes table names: `purchase_orders`, `deliveries`. */
export function plural(word: string): string {
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  return /(?:s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}
