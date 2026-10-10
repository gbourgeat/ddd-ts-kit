export interface KnexReadModelOptions<Row> {
  readonly table: string;
  /** The schema of the context. Default: the default schema of the connection. */
  readonly schema?: string;
  /** The column of the key, which is the primary key of the table. Default `id`. */
  readonly keyColumn?: string;
  /** The column of every field of the row: `{ startsAt: 'starts_at' }`. */
  readonly columns: Readonly<Record<keyof Row & string, string>>;
}
