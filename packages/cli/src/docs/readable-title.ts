/** A format placeholder of a title written for a table (`describe.each`, `it.each`): `%s`, `%i`, `%d`, `%o`, `%j`, `$name`. */
const CASE = String.raw`%[sdifjoOp]|\$[A-Za-z_][\w.]*`;
const PLACEHOLDER = new RegExp(String.raw`(?:,\s*)?(?:${CASE})`);
/** Placeholders in a row, `%s, %s`: one table of cases, read once. */
const RUN = new RegExp(String.raw`(${CASE})(?:\s*,?\s*(?:${CASE}))+`, 'g');
/** What a word does not follow with a space: an opening quote or bracket. */
const OPENING = /["'`([{“‘]$/;

/** The prepositions a title leaves before its placeholder: `read from %s`. */
const TRAILING_PREPOSITION = /(?:,|\s(?:from|of|to|with|by|for|in|on|as|at|than))$/i;

/**
 * A title as a page shows it. The cases of a table are not known without running the spec, so a
 * placeholder is not shown: at the end of a title it goes, with the comma or the preposition left
 * before it, and `(each case)` follows; one that opens the title reads `each case`, and anywhere
 * else the placeholder reads `each case`. `AppointmentExportGateway, %s` is
 * `AppointmentExportGateway (each case)`, `read from %s` is `read (each case)`, `%s, by cause` is
 * `each case, by cause`, `refuses %s with 422` is `refuses each case with 422`.
 */
export function readableTitle(text: string): string {
  const title = text.replace(RUN, '$1');
  const found = PLACEHOLDER.exec(title);

  if (found === null) {
    return title;
  }

  const before = title.slice(0, found.index).trimEnd();
  const after = title.slice(found.index + found[0].length);
  const rest = readableTitle(after);
  const last = after.trim() === '';

  if (before === '') {
    return `each case${rest}`;
  }

  return last
    ? `${withoutPreposition(before)} (each case)`
    : `${before}${OPENING.test(before) ? '' : ' '}each case${rest}`;
}

function withoutPreposition(text: string): string {
  return text.replace(TRAILING_PREPOSITION, '').trimEnd();
}
