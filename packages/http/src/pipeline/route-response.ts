export interface RouteResponse {
  readonly status: number;
  /** Lower-case names. `content-type` is set whenever there is a body. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}
