import type { AUTH_FOLDERS } from './auth-folders.js';

/** A file of `<platformDir>/auth/` the kit writes or reads, by its name. */
export type AuthFile = (typeof AUTH_FOLDERS)[keyof typeof AUTH_FOLDERS][number];
