import { REDACTED, isCredentialKey } from '@ddd-ts-kit/kernel';

/**
 * Hides, in fields the adapter owns, the value of every key `isCredentialKey` names, whatever
 * its case: the paths of pino name each key at the top as it is written.
 */
export function withoutCredentialsAtTop<Fields extends object>(fields: Fields): Fields {
  for (const key of Object.keys(fields)) {
    if (isCredentialKey(key)) {
      Object.assign(fields, { [key]: REDACTED });
    }
  }

  return fields;
}
