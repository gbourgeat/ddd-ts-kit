import type { ExecutionContextExtensions } from './execution-context-extensions';

/** The extensions as a context carries them: each one optional. */
export type ExecutionContextExtensionValues = {
  readonly [Key in keyof ExecutionContextExtensions]?: ExecutionContextExtensions[Key];
};
