/** The schema of the payload of a background job, in the validation library of the stack. */
export interface PayloadSchema {
  /** The import of the library itself, above the kernel: `import { z } from 'zod';`. */
  readonly libraryImports: readonly string[];
  /** What the job imports of the kernel past its own types: `err`, `ok`, `type BackgroundJobPayloadSchema`. */
  readonly kernelNames: readonly string[];
  /** The imports of `@ddd-ts-kit/validation`, below the kernel. */
  readonly kitImports: readonly string[];
  /** The type of the payload and its schema, above the class. */
  readonly declaration: string;
  /** The value of the static `payload` of the class. */
  readonly schema: string;
  /** What the schema calls, below the class. */
  readonly helpers: string;
}
