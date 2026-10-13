import { PreconditionFailedError } from '../../domain/errors/precondition-failed-error.js';

/**
 * Refuses to change an element whose version is not the one the caller read: the version an
 * HTTP client sent in `If-Match`, handed over in the command. Nothing is checked when the caller
 * named none.
 *
 *     const calendar = await this.calendars.findById(command.calendarId);
 *     expectVersion(calendar, command.expectedVersion);
 */
export function expectVersion(
  element: { readonly id: string | number; readonly version: number },
  expected: number | undefined,
): void {
  if (expected === undefined || element.version === expected) {
    return;
  }

  throw new PreconditionFailedError(
    `${element.id} is at version ${element.version}, and the change was made on version ${expected}.`,
  );
}
