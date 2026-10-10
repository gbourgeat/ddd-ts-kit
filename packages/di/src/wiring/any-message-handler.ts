/** The handler of any message, as a bus holds it: the message it takes is known where it was declared. */
export interface AnyMessageHandler {
  readonly execute: (message: never) => Promise<unknown>;
}
