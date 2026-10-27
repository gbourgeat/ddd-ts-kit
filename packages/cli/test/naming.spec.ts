import { describe, expect, it } from 'vitest';
import { CliError } from '../src/cli-error';
import {
  assertPastFact,
  eventName,
  looksLikePastFact,
  parseConceptName,
  parseContextName,
  toName,
} from '../src/naming';

describe('names', () => {
  it('normalizes any input case', () => {
    for (const input of [
      'InvoiceLine',
      'invoiceLine',
      'invoice-line',
      'invoice_line',
      'invoice line',
      'INVOICE_LINE',
    ]) {
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
    expect(parseConceptName('PricingService', 'domain service', { strip: ['service'] }).pascal).toBe('Pricing');
  });

  it('refuses names that are not identifiers', () => {
    expect(() => parseConceptName('1Invoice', 'aggregate')).toThrow(CliError);
    expect(() => parseConceptName('Invoice!', 'aggregate')).toThrow(CliError);
    expect(() => parseContextName('9lives')).toThrow(CliError);
  });

  it.each(['Issued', 'Paid', 'MarkedAsOverdue', 'Sent', 'Withdrawn', 'PaymentReceived'])(
    'accepts the fact %s',
    (fact) => {
      expect(looksLikePastFact(toName(fact))).toBe(true);
    },
  );

  it.each(['Issue', 'Pay', 'Cancel', 'Creation'])('refuses the fact %s unless allowed', (fact) => {
    expect(fixOf(() => assertPastFact(toName(fact), false))).toMatch(/past tense/);
    expect(() => assertPastFact(toName(fact), true)).not.toThrow();
  });

  it('builds event names', () => {
    expect(eventName(toName('billing'), toName('InvoiceLine'), toName('MarkedAsPaid'))).toBe(
      'billing.invoice-line.marked-as-paid',
    );
  });
});

function fixOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof CliError) {
      return error.fix;
    }

    throw error;
  }

  return '';
}
