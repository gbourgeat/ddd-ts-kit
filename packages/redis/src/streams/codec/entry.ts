/** One entry of a stream: its id and its fields, in the order the server holds them. */
export interface Entry {
  readonly id: string;
  readonly fields: ReadonlyMap<string, string>;
}
