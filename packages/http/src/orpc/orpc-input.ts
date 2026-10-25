/**
 * What a procedure of `orpcRouter` is called with: the parameters of its route by place and its
 * body, the input of the operation in the client `ddd-ts-kit sdk` generates. Left out, nothing.
 */
export interface OrpcInput {
  readonly path?: unknown;
  readonly query?: unknown;
  readonly header?: Readonly<Record<string, unknown>>;
  readonly body?: unknown;
}
