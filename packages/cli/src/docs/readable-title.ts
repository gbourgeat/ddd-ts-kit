/** A format placeholder of a title written for a table (`describe.each`, `it.each`): `%s`, `%i`, `%d`, `%o`, `%j`, `$name`. */
const PLACEHOLDER = /(?:,\s*)?(?:%[sdifjoOp]|\$[A-Za-z_][\w.]*)/;

/**
 * A title as a page shows it. The cases of a table are not known without running the spec, so a
 * placeholder is not shown: at the end of a title it reads `, for each case` (after the text
 * before it, trimmed of a comma), one that opens the title reads `each case`, and anywhere else
 * the placeholder reads `each case`. `AppointmentExportGateway, %s` is `AppointmentExportGateway,
 * for each case`, `%s, by cause` is `each case, by cause`, `refuses %s with 422` is `refuses each
 * case with 422`.
 */
export function readableTitle(title: string): string {
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

  return last ? `${before}, for each case` : `${before} each case${rest}`;
}
