/** The names a binding has on the server. */
export interface BindingNames {
  /** The durable consumer: instances that share it share its messages. */
  readonly durable: string;
  /** The subject the events of the type are published to. */
  readonly subject: string;
  /** The subject, in the dead-letter stream, of what this consumer gave up on. */
  readonly deadSubject: string;
}
