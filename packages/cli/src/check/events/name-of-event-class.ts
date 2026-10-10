import type { SourceFile } from '../model/source-file.js';
import { domainEventNames } from './domain-event-names.js';

/** The name written in the body of the class `className`, when the file declares that class and names it with a literal. */
export function nameOfEventClass(file: SourceFile, className: string): string | undefined {
  const declared = file.structure.classes.find((candidate) => candidate.name === className);

  if (declared === undefined) {
    return undefined;
  }

  return domainEventNames(file).find((literal) => literal.start > declared.start && literal.start < declared.end)
    ?.value;
}
