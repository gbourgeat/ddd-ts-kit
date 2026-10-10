export interface Invoice {
  readonly id: string;
  readonly customerId: string;
  readonly issuedBy: string;
  readonly issuedAt: Date;
}
