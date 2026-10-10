interface Decimal {
  readonly negative: boolean;
  readonly whole: string;
  readonly fraction: string;
}

/** Compares two decimals written as strings, digit by digit: no float, no rounding. */
export function compareDecimals(left: string, right: string): number {
  const a = parsed(left);
  const b = parsed(right);

  if (a.negative !== b.negative) return a.negative ? -1 : 1;

  return a.negative ? magnitude(b, a) : magnitude(a, b);
}

function parsed(text: string): Decimal {
  const [whole = '', fraction = ''] = text.replace(/^-/, '').split('.');
  const digits = { whole: whole.replace(/^0+(?=\d)/, ''), fraction: fraction.replace(/0+$/, '') };
  const zero = digits.whole === '0' && digits.fraction === '';

  return { ...digits, negative: text.startsWith('-') && !zero };
}

function magnitude(a: Decimal, b: Decimal): number {
  if (a.whole.length !== b.whole.length) return a.whole.length < b.whole.length ? -1 : 1;

  if (a.whole !== b.whole) return a.whole < b.whole ? -1 : 1;

  if (a.fraction === b.fraction) return 0;

  return a.fraction < b.fraction ? -1 : 1;
}
