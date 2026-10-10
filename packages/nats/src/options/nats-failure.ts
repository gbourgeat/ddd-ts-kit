export type NatsFailure =
  | {
      readonly kind: 'handler';
      readonly consumer: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly consumer: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };
