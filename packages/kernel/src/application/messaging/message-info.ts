export interface MessageInfo {
  readonly kind: 'command' | 'query';
  readonly name: string;
  /** Bounded context of the handler, when the bus was told it at registration. */
  readonly context?: string;
}
