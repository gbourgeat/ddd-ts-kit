import { isStoredData } from './is-stored-data.js';
import { isStoredList } from './is-stored-list.js';
import type { StoredData } from './stored-data.js';
import type { StoredJson } from './stored-json.js';
import { UnreadableEventError } from './unreadable-event-error.js';

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

  text(field: string): string {
    const value = this.data[field];

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

  optionalInstant(field: string): Date | undefined {
    return this.optionalText(field) === undefined ? undefined : this.instant(field);
  }

  texts(field: string): string[] {
    return this.list(field).map((item, index) => {
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
