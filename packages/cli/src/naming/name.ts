/** One name in every casing a template or a path needs. */
export interface Name {
  readonly pascal: string;
  readonly camel: string;
  readonly kebab: string;
  readonly constant: string;
  readonly words: string;
  readonly title: string;
  /** `a` or `an`, for builder factories such as `anInvoice()` and for the sentences of a template: "an invoice". */
  readonly article: string;
  /** Plural in snake_case and camelCase, for table names: `purchase_orders`, `purchaseOrders`. */
  readonly table: string;
  readonly tableCamel: string;
}
