import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { Violation } from '../model/violation';
import type { SourceFile } from '../model/source-file';
import { type ColumnDefinition, columnDefinitionsIn } from '../privacy/column-definitions-in';
import { declaresName } from '../privacy/declares-name';
import { type PersonalDeclarationOf, personalDeclarationsOf } from '../privacy/personal-declarations-of';
import { personalTermOf } from '../privacy/personal-term-of';
import { prismaColumnsOf } from '../privacy/prisma-columns-of';
import { privacyJudged } from '../privacy/privacy-judged';
import { vocabularyOf } from '../privacy/vocabulary-of';
import { reporter } from '../support/reporter';

const SUFFIX = '.personal-fields.ts';
/** A key of an event payload sealed under the key of its data subject: `name: personalData(subject, value)`. */
const SEALED = /\b([A-Za-z_$][\w$]*)\s*:\s*personalData\(/g;

/** A column named like personal data and the context that keeps it. */
interface Kept {
  readonly context: string;
  readonly file: string;
  readonly line: number;
  readonly names: readonly string[];
}

/**
 * Every column a context keeps whose name says it holds personal data (the vocabulary of the
 * kit and of `privacy.vocabulary`) is named by a `personalFields` declaration of that context:
 * the erasure, the export, the retention and the register read the declarations, never the
 * columns, and a column left out is a copy of the person nobody erases. Read in the persistence
 * files of the contexts (a Knex table, a Drizzle table, a TypeORM entity schema) and in the
 * models of `prisma/schema/` in the schema of a context. A key of an event mapper that the same
 * file seals with `personalData(subject, value)` is declared by that: it is read as `data.text('key')`
 * and is not a column. Silent with `stack.privacy` off.
 */
export const privacyDeclaredField: Rule = {
  id: 'privacy/declared-field',
  description:
    'A column whose name says it holds personal data is named by a personalFields declaration of its context, which the erasure, the export and the register read.',
  scope: 'project',
  run(project) {
    if (!privacyJudged(project)) {
      return [];
    }

    const vocabulary = vocabularyOf(project.config);
    const declarations = personalDeclarationsOf(project);
    const report = reporter(project, this.id);

    return keptColumns(project).flatMap((kept) => {
      const term = kept.names.map((name) => personalTermOf(name, vocabulary)).find((found) => found !== undefined);

      return term === undefined || kept.names.some((name) => declaresName(declarations, kept.context, name))
        ? []
        : [undeclared(report, kept, { term, declarations })];
    });
  },
};

function keptColumns(project: Project): Kept[] {
  const files = project.files.filter(
    (file) =>
      !file.isTest &&
      !file.path.endsWith(SUFFIX) &&
      file.location.area === 'context' &&
      file.location.layer === 'infrastructure' &&
      file.location.inside[0] === 'persistence',
  );

  return [
    ...files.flatMap((file) =>
      unsealed(file, columnDefinitionsIn(file)).map(({ column, property, line }) => ({
        context: file.location.area === 'context' ? file.location.context : '',
        file: file.path,
        line,
        names: property === undefined ? [column] : [column, property],
      })),
    ),
    ...prismaColumnsOf(project).map(({ context, file, line, column, field }) => ({
      context,
      file,
      line,
      names: [column, field],
    })),
  ];
}

function unsealed(file: SourceFile, columns: ColumnDefinition[]): ColumnDefinition[] {
  const sealed = new Set([...file.scan.code.matchAll(SEALED)].map((match) => match[1]));

  return columns.filter(({ column, property }) => ![column, property].some((name) => sealed.has(name)));
}

function undeclared(
  report: ReturnType<typeof reporter>,
  kept: Kept,
  { term, declarations }: { readonly term: string; readonly declarations: readonly PersonalDeclarationOf[] },
): Violation {
  const column = kept.names[0] ?? '';
  const where = declarations.find((declaration) => declaration.context === kept.context)?.file;

  return report(
    kept,
    `The column ${column} of ${kept.context} is named like personal data (${term}), and no personalFields declaration of ${kept.context} names it: the erasure, the export and the register of personal data do not reach it.`,
    `Name it in the fields of the declaration of its table (${where ?? `infrastructure/persistence/<aggregate>${SUFFIX}`}, which \`ddd-ts-kit generate repository ${kept.context} <Aggregate> --personal <column>,...\` writes). A column that holds nothing of a person in this project is recorded: \`// ddd-ts-kit-disable-next-line privacy/declared-field -- ADR-NNNN: <why>\` above it, or the word in \`privacy.allow\` of ddd-ts-kit.config.json.`,
  );
}
