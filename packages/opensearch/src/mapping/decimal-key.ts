const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** The most digits before the point a key can order: the length is written on three digits. */
const MAX_WHOLE_DIGITS = 999;

/**
 * A decimal as a keyword whose order, byte by byte, is the order of the numbers: what a `keyword`
 * field sorts and compares in ranges, with no float and no rounding. Zero is `1`; a positive
 * number is `2`, the count of its whole digits on three digits, then its digits; a negative one is
 * `0`, then the same with each digit taken from 9 and its count from 999, ended by `~`, which sorts
 * after every digit. `10.50` and `10.5` have one key, as they are one number.
 */
export function decimalKey(text: string): string {
  const match = DECIMAL.exec(text);

  if (match === null) {
    throw new TypeError(`A decimal is written as digits, with an optional "-" and fraction: ${JSON.stringify(text)}`);
  }

  const [, sign = '', written = '', fraction = ''] = match;
  const whole = written.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');

  if (whole.length > MAX_WHOLE_DIGITS) {
    throw new TypeError(`A decimal has at most ${String(MAX_WHOLE_DIGITS)} digits before its point`);
  }

  if (whole === '0' && decimals === '') {
    return '1';
  }

  return sign === '-'
    ? `0${padded(MAX_WHOLE_DIGITS - whole.length)}${complement(whole + decimals)}~`
    : `2${padded(whole.length)}${whole}${decimals}`;
}

function padded(count: number): string {
  return String(count).padStart(3, '0');
}

function complement(digits: string): string {
  return Array.from(digits, (digit) => String(9 - Number(digit))).join('');
}
