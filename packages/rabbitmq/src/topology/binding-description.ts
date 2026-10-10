export interface BindingDescription {
  readonly exchange: string;
  readonly queue: string;
  readonly routingKey: string;
}
