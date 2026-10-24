/**
 * A declaration pseudonymises a personal column that is not a text and does not accept null:
 * pseudonymised, it would read nothing, which the database refuses. An adapter refuses the
 * declaration before any file or row is touched, since an erasure that failed half-way would
 * have deleted the files of the person and left their rows in clear, and run again the same.
 */
export class NotNullablePersonalColumnError extends Error {
  constructor(table: string, column: string) {
    super(
      `The personal column "${column}" of ${table} is not a text and does not accept null: pseudonymised, it would read nothing, which the database refuses. Declare the column nullable, or erase the rows of the table with erasure: 'row'`,
    );

    this.name = 'NotNullablePersonalColumnError';
  }
}
