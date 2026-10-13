/** The route whose items are the options of a field: a front end calls it as the user types or opens the list. */
export interface FieldLookup {
  readonly operation: string;
  readonly method: 'GET';
  readonly path: string;
}
