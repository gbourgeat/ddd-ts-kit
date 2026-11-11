import type { PersonalColumn } from './personal-column';

/** A table as the schema of a context declares it, read from the text of the file. */
export interface SchemaTable {
  /** The table as the database names it. */
  readonly name: string;
  /** What the schema calls it: the exported constant of a Drizzle table or of a TypeORM entity schema, the model on Prisma, the SQL name on Knex. */
  readonly reference: string;
  /** The columns its definition names, each as the database spells it and as the definition does. */
  readonly columns: readonly PersonalColumn[];
  /** True when the definition takes columns from elsewhere (a spread, a helper called on the table): the ones it names are not all it holds. */
  readonly open: boolean;
}
