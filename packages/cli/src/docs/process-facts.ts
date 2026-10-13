export interface ProcessFacts {
  /** `<context>.<process-name>`, the static `processName` of the class; the class when it is not a literal. */
  readonly name: string;
  readonly className: string;
  /** The background job that delivers its timeouts; empty when it arms none. */
  readonly timeoutJob: string;
}
