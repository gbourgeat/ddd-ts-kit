export type RedisStreamsFailure =
  | {
      readonly kind: 'handler';
      readonly stream: string;
      readonly consumer: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly stream: string; readonly consumer: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };
