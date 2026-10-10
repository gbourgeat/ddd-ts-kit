const SOURCE = /\.(?:ts|mts|cts)$/;
const DECLARATION = /\.d\.(?:ts|mts|cts)$/;

/** A TypeScript source the rules read: not a declaration file. */
export function isSource(file: string): boolean {
  return SOURCE.test(file) && !DECLARATION.test(file);
}
