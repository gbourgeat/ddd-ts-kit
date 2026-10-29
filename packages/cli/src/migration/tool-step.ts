/** One run of the CLI of an ORM; `{url}`, in an argument or in a variable, is the address of the in-process database. */
export interface ToolStep {
  /** The script under `node_modules` (`prisma/build/index.js`). */
  readonly bin: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}
