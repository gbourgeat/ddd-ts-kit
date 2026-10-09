import { describe, expect, it } from 'vitest';
import { CliError } from '../src/errors.js';
import { assertPastFact, eventName, looksLikePastFact, parseConceptName, parseContextName, toName } from '../src/naming.js';

describe('names', () => {
  it('normalizes any input case', () => {
    for (const input of ['InvoiceLine', 'invoiceLine', 'invoice-line', 'invoice_line', 'invoice line', 'INVOICE_LINE']) {
      const name = toName(input);
      expect([name.pascal, name.camel, name.kebab, name.constant, name.words], input).toEqual([
        'InvoiceLine',
        'invoiceLine',
        'invoice-line',
        'INVOICE_LINE',
        'invoice line',
      ]);
    }
  });

  it('keeps acronyms together', () => {
    expect(toName('HTTPGateway').kebab).toBe('http-gateway');
  });

  it('strips the role suffix the generator adds itself', () => {
    expect(parseConceptName('PricingService', 'domain service', { allowName: false, strip: ['service'] }).pascal).toBe('Pricing');
  });

  it.each(['InvoiceManager', 'PriceHelper', 'DateUtil', 'StringUtils', 'CustomerData', 'OrderInfo'])('refuses the vague name %s', (input) => {
    expect(fixOf(() => parseConceptName(input, 'aggregate', { allowName: false }))).toMatch(/ubiquitous language/);
  });

  it('accepts a vague suffix with --allow-name', () => {
    expect(parseConceptName('MarketData', 'aggregate', { allowName: true }).pascal).toBe('MarketData');
  });

  it('refuses names that are not identifiers', () => {
    expect(() => parseConceptName('1Invoice', 'aggregate', { allowName: false })).toThrow(CliError);
    expect(() => parseConceptName('Invoice!', 'aggregate', { allowName: false })).toThrow(CliError);
    expect(() => parseContextName('9lives')).toThrow(CliError);
  });

  it.each(['Issued', 'Paid', 'MarkedAsOverdue', 'Sent', 'Withdrawn', 'PaymentReceived'])('accepts the fact %s', (fact) => {
    expect(looksLikePastFact(toName(fact))).toBe(true);
  });

  it.each(['Issue', 'Pay', 'Cancel', 'Creation'])('refuses the fact %s unless allowed', (fact) => {
    expect(fixOf(() => assertPastFact(toName(fact), false))).toMatch(/past tense/);
    expect(() => assertPastFact(toName(fact), true)).not.toThrow();
  });

  it('builds event names', () => {
    expect(eventName(toName('billing'), toName('InvoiceLine'), toName('MarkedAsPaid'))).toBe('billing.invoice-line.marked-as-paid');
  });
});

function fixOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof CliError) return error.fix;
    throw error;
  }
  return '';
}
