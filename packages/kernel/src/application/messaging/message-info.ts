export interface MessageInfo {
  readonly kind: 'command' | 'query';
  readonly name: string;
}
