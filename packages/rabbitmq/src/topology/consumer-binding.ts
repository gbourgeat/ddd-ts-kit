/** One consuming context listening to one event type. */
export interface ConsumerBinding {
  readonly consumer: string;
  readonly type: string;
}
