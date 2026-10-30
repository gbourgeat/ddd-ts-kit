/** Where each ORM declares the tables of a context: the file its migration tooling reads, and the template that starts it. */
export const TABLES_FILES: Readonly<Record<string, (context: string) => string>> = {
  drizzle: (context) => `${context}.schema`,
  typeorm: (context) => `${context}.schema`,
  knex: (context) => `create-${context}-tables.schema`,
};
