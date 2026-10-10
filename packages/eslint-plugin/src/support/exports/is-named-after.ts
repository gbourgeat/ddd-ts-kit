import { kebabCase } from '../kebab-case.js';

/**
 * The names an export allows its file to carry, without the extension: its own in kebab-case,
 * also written with dots (`issue-invoice.handler` for `IssueInvoiceHandler`), and, in a role
 * file `<name>.<role>` whose export does not end with the role word, the part before the first
 * dot (`invoice.aggregate` for `Invoice`, `payment-gateway.port` for `PaymentGateway`).
 */
export function isNamedAfter(stem: string, exported: string): boolean {
  const expected = kebabCase(exported);

  if (stem.replaceAll('.', '-') === expected) {
    return true;
  }

  const [name = '', ...roles] = stem.split('.');

  return roles.length > 0 && name === expected && !expected.endsWith(`-${roles.at(-1) ?? ''}`);
}
