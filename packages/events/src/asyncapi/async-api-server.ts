export interface AsyncApiServer {
  readonly host: string;
  /** `amqp`, `kafka`, `nats`, `sqs`... */
  readonly protocol: string;
  readonly description?: string;
}
