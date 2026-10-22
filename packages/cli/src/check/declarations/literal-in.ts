import type { Scan } from '../scan/scan';
import type { ListPart } from '../text/list-part';

/** The first string literal written inside an argument, such as the permission name of `permissions['invoice.issue']`. */
export function literalIn(scan: Scan, argument: ListPart): string | undefined {
  const end = argument.start + argument.code.length;

  return scan.strings.find((literal) => literal.start >= argument.start && literal.start < end)?.value;
}
