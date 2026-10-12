/** The statements a generated file holds to register what constructors receive, already laid out. */
export interface RenderedInjections {
  /** The import of `injected`, then one import per module a class or a token comes from, sorted by specifier. */
  readonly imports: readonly string[];
  /** One `injected(Class, [Tokens]);` per class that is given something, in the order of the role files. */
  readonly calls: readonly string[];
}
