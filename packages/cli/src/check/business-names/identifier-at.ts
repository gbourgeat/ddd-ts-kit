const NAME = /^[A-Za-z_$][\w$]*/;

/** The identifier that starts at `offset`, or an empty text. */
export function identifierAt(code: string, offset: number): string {
  return NAME.exec(code.slice(offset, offset + 200))?.[0] ?? '';
}
