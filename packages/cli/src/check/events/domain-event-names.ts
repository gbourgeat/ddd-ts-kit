import type { SourceFile } from '../model/source-file';
import type { StringRecord } from '../scan/string-record';

/** `name = '...'`, `name: '...'`, `name: string = '...'`, and the same of `eventName`. */
const NAME_PROPERTY =
  /(?<![\w$.])(?:name|eventName)\s*\??\s*(?:[:=]|:[^=;\n'"]+=)\s*$|(?<![\w$.])NamedDomainEvent\s*\(\s*$/;

/**
 * The name a domain event class gives itself: `extends NamedDomainEvent('...')` or `static readonly eventName = '...'`, which its
 * `readonly name` and its reactions read, or as 0.5 wrote it, `readonly name = '...'`.
 */
export function domainEventNames(file: SourceFile): StringRecord[] {
  return file.scan.strings.filter((literal) =>
    NAME_PROPERTY.test(file.scan.code.slice(Math.max(0, literal.start - 200), literal.start)),
  );
}
