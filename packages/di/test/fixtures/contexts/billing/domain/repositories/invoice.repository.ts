export interface Invoice {
  readonly id: string;
  readonly customerId: string;
  readonly issuedBy: string;
  readonly issuedAt: Date;
}

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findById(id: string): Promise<Invoice | undefined>;
}
