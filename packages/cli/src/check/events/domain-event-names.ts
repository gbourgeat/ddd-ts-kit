import type { SourceFile } from '../model/source-file.js';
import type { StringRecord } from '../scan/string-record.js';

/** `name = '...'`, `name: '...'` and `name: string = '...'`. */
const NAME_PROPERTY = /(?<![\w$.])name\s*\??\s*(?:[:=]|:[^=;\n'"]+=)\s*$/;

/** The `name` a domain event class gives itself: `readonly name = '...'`, `name: string = '...'`. */
export function domainEventNames(file: SourceFile): StringRecord[] {
  return file.scan.strings.filter((literal) => NAME_PROPERTY.test(file.scan.code.slice(Math.max(0, literal.start - 200), literal.start)));
}
