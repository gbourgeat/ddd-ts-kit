import { REDACTED, isCredentialKey, type LogValue } from '@ddd-ts-kit/kernel';

type Fields = Readonly<Record<string, LogValue>>;

/**
 * The fields with the value of every credential key hidden, whatever its case, at the top of an
 * entry and one level below, as pino and winston hide them. A nested object belongs to the
 * caller: it is copied when a key has to be hidden, never written to.
 */
export function withoutCredentials(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, isCredentialKey(key) ? REDACTED : nestedWithout(value)]),
  );
}

function nestedWithout(value: LogValue): LogValue {
  if (!isRecord(value) || !Object.keys(value).some(isCredentialKey)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, isCredentialKey(key) ? REDACTED : nested]),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, LogValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}
