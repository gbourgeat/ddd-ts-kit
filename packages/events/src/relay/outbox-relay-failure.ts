export type OutboxRelayFailure =
  | {
      readonly kind: 'publish';
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempts: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'tick'; readonly code: string };
