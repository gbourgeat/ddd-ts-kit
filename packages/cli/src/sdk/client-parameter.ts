/** A parameter of an operation sent in its path, its query or a header. */
export interface ClientParameter {
  readonly name: string;
  readonly in: 'path' | 'query' | 'header';
  readonly required: boolean;
  readonly schema: unknown;
  readonly description: string;
}
