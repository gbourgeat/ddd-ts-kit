/**
 * The arguments of `generate error` for the refusal of billing, in the form the project records:
 * a class of its own by default (`"stack.refusals": "named"`), a factory of the error class of its
 * concept when `init` was given `--refusals factories` or `--refusals classes`.
 */
export function refusalOf(more: readonly string[]): string[] {
  const asked = more.indexOf('--refusals');

  return asked === -1 || more[asked + 1] === 'named'
    ? ['InvoiceAlreadyIssued', 'forInvoice']
    : ['Invoice', 'alreadyIssued', '--code', 'INVOICE_ALREADY_ISSUED'];
}
