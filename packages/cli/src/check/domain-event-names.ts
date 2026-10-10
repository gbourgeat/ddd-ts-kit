import type { SourceFile } from './types.js';

/** The `name` a domain event class gives itself: `readonly name = '...'`, `name: string = '...'`. */

/** `key = '...'`, `key: '...'` and `key: string = '...'`. */
const property = (key: string): RegExp => new RegExp(`(?<![\\w$.])${key}\\s*\\??\\s*(?:[:=]|:[^=;\\n'"]+=)\\s*$`);
const NAME_PROPERTY = property('name');

type Literal = SourceFile['scan']['strings'][number];

export function domainEventNames(file: SourceFile): Literal[] {
  return file.scan.strings.filter((literal) => NAME_PROPERTY.test(file.scan.code.slice(Math.max(0, literal.start - 200), literal.start)));
}

/** The name written in the body of the class `className`, when the file declares that class and names it with a literal. */
export function nameOfEventClass(file: SourceFile, className: string): string | undefined {
  const declared = file.structure.classes.find((candidate) => candidate.name === className);
  if (declared === undefined) return undefined;
  return domainEventNames(file).find((literal) => literal.start > declared.start && literal.start < declared.end)?.value;
}
