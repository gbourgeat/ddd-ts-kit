import type { SessionExtensions } from './session-extensions.js';

/** The extensions as a session carries them: each one optional. */
export type SessionExtensionValues = {
  readonly [Key in keyof SessionExtensions]?: SessionExtensions[Key];
};
