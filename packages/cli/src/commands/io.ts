/** Where a command prints: the terminal, or what a test captures. */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}
