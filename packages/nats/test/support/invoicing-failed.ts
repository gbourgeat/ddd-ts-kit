/** The failure of a handler: its message quotes personal data, which must never travel. */
export class InvoicingFailed extends Error {
  readonly code = 'INVOICING_FAILED';

  constructor() {
    super('could not invoice jane.doe@example.com');
  }
}
