import { describe, expect, it } from 'vitest';
import { PRECONDITION_FAILED, PreconditionFailedError, expectVersion } from '../src/index.js';

describe('expectVersion', () => {
  const calendar = { id: 'calendar-1', version: 4 };

  it('lets a change through when the caller read the current version, or named none', () => {
    expect(() => expectVersion(calendar, 4)).not.toThrow();
    expect(() => expectVersion(calendar, undefined)).not.toThrow();
  });

  it('refuses a change made on a version that is no longer the current one, with a code HTTP answers 412', () => {
    const refused = (): void => expectVersion(calendar, 3);

    expect(refused).toThrow(PreconditionFailedError);
    expect(refused).toThrow('calendar-1 is at version 4, and the change was made on version 3.');
    expect(refused).toThrow(expect.objectContaining({ code: PRECONDITION_FAILED, name: 'PreconditionFailedError' }));
  });
});
