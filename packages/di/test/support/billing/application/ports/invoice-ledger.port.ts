export abstract class InvoiceLedger {
  abstract readonly invoicedOrders: readonly string[];

  abstract record(orderId: string): Promise<void>;
}
