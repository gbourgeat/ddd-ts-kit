import { ERASED_PERSONAL_DATA, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { PersonalEvent } from './personal-event';

const LIST = '[]';

/** A payload that holds fields, the only kind a declaration can name. */
type PersonalPayloadRecord = Readonly<Record<string, unknown>>;

/**
 * The payload of a stored event once `subject` is erased, or `undefined` when there is nothing to
 * change: no declaration names this event, the payload names another person, or the fields read
 * erased already. A text reads `ERASED_PERSONAL_DATA` and any other value nothing, as the columns of
 * a pseudonymised row do. Paths are those of a declaration: `email`, `customer.email`,
 * `lines[].recipient`. The lines of a list that name several people are erased together.
 */
export function erasedPayloadOf(
  event: Pick<IntegrationEvent, 'type' | 'version' | 'payload'>,
  subject: string,
  events: readonly PersonalEvent[],
): PersonalPayloadRecord | undefined {
  const { payload } = event;
  const declared = events.find(({ type, version }) => type === event.type && version === event.version);

  if (declared === undefined || !isObject(payload)) {
    return undefined;
  }

  if (!valuesAt(payload, pathOf(declared.personal.subject)).includes(subject)) {
    return undefined;
  }

  const erased = declared.personal.fields.reduce((record, field) => erasedIn(record, pathOf(field)), payload);

  return JSON.stringify(erased) === JSON.stringify(payload) ? undefined : erased;
}

function pathOf(field: string): readonly string[] {
  return field.split('.');
}

function valuesAt(value: unknown, [segment, ...rest]: readonly string[]): readonly unknown[] {
  if (segment === undefined) {
    return [value];
  }

  const nested = isObject(value) ? value[nameOf(segment)] : undefined;

  return Array.isArray(nested) && segment.endsWith(LIST)
    ? nested.flatMap((item: unknown) => valuesAt(item, rest))
    : valuesAt(nested, rest);
}

function erasedIn(record: PersonalPayloadRecord, [segment = '', ...rest]: readonly string[]): PersonalPayloadRecord {
  const name = nameOf(segment);

  if (!(name in record)) {
    return record;
  }

  const nested = record[name];

  const erased =
    Array.isArray(nested) && segment.endsWith(LIST)
      ? nested.map((item: unknown) => erasedValue(item, rest))
      : erasedValue(nested, rest);

  return { ...record, [name]: erased };
}

function erasedValue(value: unknown, path: readonly string[]): unknown {
  if (path.length === 0) {
    return typeof value === 'string' ? ERASED_PERSONAL_DATA : null;
  }

  return isObject(value) ? erasedIn(value, path) : value;
}

function nameOf(segment: string): string {
  return segment.endsWith(LIST) ? segment.slice(0, -LIST.length) : segment;
}

function isObject(value: unknown): value is PersonalPayloadRecord {
  return typeof value === 'object' && value !== null;
}
