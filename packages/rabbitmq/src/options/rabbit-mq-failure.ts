export type RabbitMqFailure =
  | {
      readonly kind: 'handler';
      readonly queue: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly queue: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };
