import type { PersonalDataRetention } from '../ports/personal-data-retention';

/** Whether a copy also purges what outlived its retention: the erasure adapters of the persistence packages do, a copy written by hand may not. */
export function isPersonalDataRetention<T>(value: T): value is T & PersonalDataRetention {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'name') === 'string' &&
    typeof Reflect.get(value, 'purgeExpired') === 'function'
  );
}
