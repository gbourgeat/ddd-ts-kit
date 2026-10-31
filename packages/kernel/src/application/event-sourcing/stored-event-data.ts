import { ERASED_PERSONAL_DATA } from './erased-personal-data';
import { isErasedValue } from './is-erased-value';
import { isStoredData } from './is-stored-data';
import { isStoredList } from './is-stored-list';
import type { StoredData } from './stored-data';
import type { StoredJson } from './stored-json';
import { UnreadableEventError } from './unreadable-event-error';

/**
 * The data of a stored event as `decode` reads it. Each read names the field and the type it
 * expects, and refuses a field that is absent or of another type with an UnreadableEventError:
 * a corrupt row or a forgotten upcaster stops the load instead of building a wrong aggregate.
 */
export class StoredEventData {
  constructor(
    readonly data: StoredData,
    private readonly where: string,
  ) {}

  /** A text; a personal value whose subject was erased reads `ERASED_PERSONAL_DATA`. */
  text(field: string): string {
    const value = this.data[field];

    if (isErasedValue(value)) {
      return ERASED_PERSONAL_DATA;
    }

    if (typeof value !== 'string') {
      throw this.unreadable(field, 'a text');
    }

    return value;
  }

  optionalText(field: string): string | undefined {
    return this.data[field] === undefined || this.data[field] === null ? undefined : this.text(field);
  }

  number(field: string): number {
    const value = this.data[field];

    if (typeof value !== 'number') {
      throw this.unreadable(field, 'a number');
    }

    return value;
  }

  flag(field: string): boolean {
    const value = this.data[field];

    if (typeof value !== 'boolean') {
      throw this.unreadable(field, 'a boolean');
    }

    return value;
  }

  /** A date, kept as its ISO text. */
  instant(field: string): Date {
    const date = new Date(this.text(field));

    if (Number.isNaN(date.getTime())) {
      throw this.unreadable(field, 'an instant');
    }

    return date;
  }

  /** A date that may be absent; a personal date whose subject was erased reads as absent. */
  optionalInstant(field: string): Date | undefined {
    return this.optionalText(field) === undefined || this.isErased(field) ? undefined : this.instant(field);
  }

  /**
   * Whether the field held a personal value whose subject was erased: the key that sealed it is
   * gone. Told by what the cipher opens such a value into, an `ErasedValue`, never by its text: a
   * text that reads `[erased]` is a text.
   */
  isErased(field: string): boolean {
    return isErasedValue(this.data[field]);
  }

  /**
   * A personal value, read by `read` from its text (a value object, a parsed code), or `undefined`
   * when the field is absent or its subject was erased. `read` never sees `ERASED_PERSONAL_DATA`,
   * so a value that is not free text keeps the aggregate readable after an erasure.
   */
  personal<T>(field: string, read: (text: string) => T): T | undefined {
    const text = this.optionalText(field);

    return text === undefined || this.isErased(field) ? undefined : read(text);
  }

  /** A personal text, or `undefined` when it is absent or its subject was erased. */
  personalText(field: string): string | undefined {
    return this.personal(field, (text) => text);
  }

  /**
   * A personal date, kept as its ISO text, or `undefined` when it is absent or its subject was
   * erased. A text that is no date is an `UnreadableEventError`, as with `instant`.
   */
  personalInstant(field: string): Date | undefined {
    return this.personal(field, () => this.instant(field));
  }

  texts(field: string): string[] {
    return this.list(field).map((item, index) => {
      if (isErasedValue(item)) {
        return ERASED_PERSONAL_DATA;
      }

      if (typeof item !== 'string') {
        throw this.unreadable(`${field}[${index}]`, 'a text');
      }

      return item;
    });
  }

  record(field: string): StoredEventData {
    return this.nested(this.data[field], field);
  }

  records(field: string): StoredEventData[] {
    return this.list(field).map((item, index) => this.nested(item, `${field}[${index}]`));
  }

  private list(field: string): readonly StoredJson[] {
    const value = this.data[field];

    if (!isStoredList(value)) {
      throw this.unreadable(field, 'a list');
    }

    return value;
  }

  private nested(value: StoredJson | undefined, field: string): StoredEventData {
    if (!isStoredData(value)) {
      throw this.unreadable(field, 'an object');
    }

    return new StoredEventData(value, `${this.where}, ${field}`);
  }

  private unreadable(field: string, expected: string): UnreadableEventError {
    return new UnreadableEventError(`${this.where}: "${field}" is not ${expected}`);
  }
}
