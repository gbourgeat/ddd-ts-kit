import { personalDeclarationsIn, type PersonalDeclaration } from '../../docs/personal-declarations-in';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';

const SUFFIX = '.personal-fields.ts';

/** One `personalFields` call of a context, where it is written. */
export interface PersonalDeclarationOf extends PersonalDeclaration {
  readonly context: string;
  readonly file: string;
  readonly line: number;
}

/**
 * Every `personalFields` call of the `infrastructure/persistence/*.personal-fields.ts` files of the
 * contexts, its columns named as the database names them (a Drizzle table or a TypeORM entity
 * schema of the context read back), as `ddd-ts-kit docs` lists them in the register.
 */
export function personalDeclarationsOf(project: Project): PersonalDeclarationOf[] {
  const persistence = project.files.filter((file) => !file.isTest && persistenceOf(file) !== undefined);

  return persistence
    .filter((file) => file.path.endsWith(SUFFIX))
    .flatMap((file) => {
      const context = persistenceOf(file) ?? '';

      const sources = persistence
        .filter((other) => persistenceOf(other) === context)
        .map((other) => other.text)
        .join('\n');

      return personalDeclarationsIn(file.text, sources).map((declaration) => ({
        ...declaration,
        context,
        file: file.path,
        line: file.scan.lineAt(declaration.offset),
      }));
    });
}

/** The context of a file of `infrastructure/persistence/`, or undefined. */
function persistenceOf(file: SourceFile): string | undefined {
  const { location } = file;

  return location.area === 'context' && location.layer === 'infrastructure' && location.inside[0] === 'persistence'
    ? location.context
    : undefined;
}
