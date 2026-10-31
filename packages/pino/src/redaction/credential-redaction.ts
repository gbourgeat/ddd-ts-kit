import { CREDENTIAL_KEYS, REDACTED, isCredentialKey } from '@ddd-ts-kit/kernel';

/** A value for the `redact` option of pino. */
export interface CredentialRedaction {
  readonly paths: string[];
  censor(value: unknown, path: readonly string[]): unknown;
}

const ONE_LEVEL_BELOW = '*.*';

/**
 * The pino `redact` option hiding `CREDENTIAL_KEYS` and the given keys at the top of a line and
 * one level below, in the fields of an entry, of a child and of the mixin alike. At the top a
 * path names each key as it is written: pino gives the censor of a wildcard at the top no key
 * name, and `PinoLogger` hides the keys of the kernel whatever their case before pino sees the
 * line. The level below is one wildcard path whose censor compares the name of the key without
 * case: a wildcard path per key would cost pino as many passes over each line.
 */
export function credentialRedaction(keys: readonly string[] = CREDENTIAL_KEYS): CredentialRedaction {
  const named = [...new Set([...CREDENTIAL_KEYS, ...keys])];
  const added: ReadonlySet<string> = new Set(keys.map((key) => key.toLowerCase()));

  return {
    paths: [...named.map((key) => `["${key}"]`), ONE_LEVEL_BELOW],
    censor: (value, path) => {
      const name = path.at(-1) ?? '';

      return isCredentialKey(name) || added.has(name.toLowerCase()) ? REDACTED : value;
    },
  };
}
