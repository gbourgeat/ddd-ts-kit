/** The table the fields are written in. */
export interface ReadModelTable {
  /** Its name in the database, and the start of the name of what it declares. */
  readonly name: string;
  /** The constant of the Drizzle table and of the TypeORM entity. */
  readonly constant: string;
  /** The database schema of its context. */
  readonly schema: string;
  readonly tenantScoped: boolean;
}
