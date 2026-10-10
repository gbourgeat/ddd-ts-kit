/** Where the compiler reads and writes, as tsconfig says: both relative to the project root. */
export interface BuildLayout {
  readonly rootDir: string;
  readonly outDir: string;
}
