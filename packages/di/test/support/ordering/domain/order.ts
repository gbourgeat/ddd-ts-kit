export interface Order {
  readonly id: string;
  readonly sku: string;
  readonly placedAt: Date;
  cancelled: boolean;
}
