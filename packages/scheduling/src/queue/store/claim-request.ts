export interface ClaimRequest {
  readonly queue: string;
  readonly limit: number;
  readonly now: Date;
  /** How long the claimed jobs stay invisible to other claims. */
  readonly leaseMs: number;
}
