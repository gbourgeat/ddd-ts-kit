/** What a bus is told of a handler when it is registered, for its middlewares to read in `MessageInfo`. */
export interface HandlerRegistration {
  /** Bounded context the handler belongs to. */
  readonly context?: string;
}
