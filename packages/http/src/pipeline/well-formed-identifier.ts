const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** A header value usable as an identifier in logs and response headers, else `undefined`. */
export function wellFormedIdentifier(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value : undefined;
}
