/** A format placeholder of a title written for a table (`describe.each`, `it.each`): `%s`, `%i`, `%d`, `%o`, `%j`, `$name`. */
const PLACEHOLDER = /(?:,\s*)?(?:%[sdifjoOp]|\$[A-Za-z_][\w.]*)/;

/**
 * A title as a page shows it. The cases of a table are not known without running the spec, so a
 * placeholder is not shown: after a comma, `for each case` follows the text before it, trimmed of
 * the comma; anywhere else the placeholder reads `each case`. `AppointmentExportGateway, %s` is `AppointmentExportGateway for each case`, `%s` is
 * `each case`, `refuses %s with 422` is `refuses each case with 422`.
 */
export function readableTitle(title: string): string {
  const found = PLACEHOLDER.exec(title);

  if (found === null) {
    return title;
  }

  const before = title.slice(0, found.index).trimEnd();
  const after = title.slice(found.index + found[0].length);
  const rest = readableTitle(after);
  const apart = found[0].startsWith(',');

  if (before === '') {
    return `each case${rest}`;
  }

  return `${before} ${apart ? 'for each case' : 'each case'}${rest}`;
}
