import { decimalText } from './decimal-text.js';
import type { MoneyBody } from './money-body.js';

const CURRENCY = /^[A-Z]{3}$/;

/** `money('12.30', 'EUR')` is `{ amount: '12.30', currency: 'EUR' }`: never an amount without its currency, never a float. */
export function money(amount: string | number | bigint, currency: string): MoneyBody {
  if (!CURRENCY.test(currency)) {
    throw new RangeError(`"${currency}" is not an ISO 4217 currency code.`);
  }

  return { amount: decimalText(amount), currency };
}
