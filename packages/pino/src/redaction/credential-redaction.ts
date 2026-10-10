import { CREDENTIAL_KEYS, REDACTED } from '@ddd-ts-kit/kernel';

/** A value for the `redact` option of pino. */
export interface CredentialRedaction {
  readonly paths: string[];
  censor(value: unknown, path: readonly string[]): unknown;
}

const ONE_LEVEL_BELOW = '*.*';

/**
 * The pino `redact` option hiding the given keys at the top of a line and one level below, in
 * the fields of an entry, of a child and of the mixin alike. Names are matched exactly, case
 * included. The level below is one wildcard path whose censor looks at the name of the key:
 * a wildcard path per key would cost pino as many passes over each line.
 */
export function credentialRedaction(keys: readonly string[] = CREDENTIAL_KEYS): CredentialRedaction {
  const hidden: ReadonlySet<string> = new Set(keys);

  return {
    paths: [...[...hidden].map((key) => `["${key}"]`), ONE_LEVEL_BELOW],
    censor: (value, path) => (hidden.has(path.at(-1) ?? '') ? REDACTED : value),
  };
}
