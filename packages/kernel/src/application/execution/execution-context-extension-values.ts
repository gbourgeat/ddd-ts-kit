import type { ExecutionContextExtensions } from './execution-context-extensions.js';

/** The extensions as a context carries them: each one optional. */
export type ExecutionContextExtensionValues = {
  readonly [Key in keyof ExecutionContextExtensions]?: ExecutionContextExtensions[Key];
};
