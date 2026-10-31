import { CREDENTIAL_KEYS } from './credential-keys';

const CREDENTIALS: ReadonlySet<string> = new Set(CREDENTIAL_KEYS.map((key) => key.toLowerCase()));

/** Whether a field of that name holds a credential: one of `CREDENTIAL_KEYS`, whatever its case. */
export function isCredentialKey(name: string): boolean {
  return CREDENTIALS.has(name.toLowerCase());
}
