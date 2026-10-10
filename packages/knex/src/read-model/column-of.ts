/** The column a field is mapped to. A field without a column is a mistake of the adapter, never of a caller. */
export function columnOf(columns: Readonly<Record<string, string>>, field: string): string {
  const column = Object.hasOwn(columns, field) ? columns[field] : undefined;

  if (column === undefined) throw new Error(`The field "${field}" is mapped to no column`);

  return column;
}
