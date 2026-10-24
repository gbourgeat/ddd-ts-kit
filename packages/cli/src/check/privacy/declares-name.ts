import type { PersonalDeclarationOf } from './personal-declarations-of';
import { sameName } from './same-name';

/** A declaration of the context names the column: as one of its personal fields or files, or as its subject. */
export function declaresName(declarations: readonly PersonalDeclarationOf[], context: string, name: string): boolean {
  return declarations.some(
    (declaration) =>
      declaration.context === context &&
      [declaration.subject, ...declaration.fields, ...declaration.files].some((declared) => sameName(declared, name)),
  );
}
