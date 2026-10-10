/** Where a route answers, as `--method` and `--path` say it. */
export interface Endpoint {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly parameters: readonly string[];
}
