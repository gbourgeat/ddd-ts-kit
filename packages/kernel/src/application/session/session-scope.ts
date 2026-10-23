import type { SessionScopes } from './session-scopes';

/** A scope of the project's vocabulary once `SessionScopes` declares one, any string before. */
export type SessionScope = [keyof SessionScopes] extends [never] ? string : Extract<keyof SessionScopes, string>;
