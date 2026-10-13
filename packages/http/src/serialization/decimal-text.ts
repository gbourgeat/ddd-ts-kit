const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * A decimal as the text every representation carries, never a binary number a client would
 * round: `'12.30'`. A number is accepted when JavaScript writes it without an exponent.
 */
export function decimalText(value: string | number | bigint): string {
  const text = typeof value === 'string' ? value : String(value);

  if (!DECIMAL.test(text)) {
    throw new RangeError(`"${text}" is not a decimal written in full.`);
  }

  return text;
}
