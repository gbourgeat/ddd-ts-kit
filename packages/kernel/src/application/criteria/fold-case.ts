/**
 * A text as `containsIgnoringCase` and `startsWithIgnoringCase` compare it: each letter in lower
 * case, and nothing else. An accent is kept (`e` does not find `é`) and no letter is rewritten
 * (`ss` does not find `ß`).
 *
 * Every store answers the same for the ASCII letters and for the letters that have exactly one
 * upper-case and one lower-case form, each one character long (`É` and `é`, `Ñ` and `ñ`, `Ø` and
 * `ø`, Greek and Cyrillic included). Outside them each store follows its own table: the dotted
 * and dotless `I` of Turkish, `ß` and `ẞ`, the final sigma, the ligatures and the Kelvin sign.
 * PostgreSQL folds with the locale of the database, and a database created with the `C` locale
 * folds the ASCII letters alone.
 */
export function foldCase(text: string): string {
  return text.toLowerCase();
}
