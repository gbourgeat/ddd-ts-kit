import { errorReportOf } from '@ddd-ts-kit/kernel';
import { afterEach, describe, expect, it } from 'vitest';
import { aTracker, type Tracker } from './support/a-tracker.js';

let tracker: Tracker | undefined;

afterEach(async () => {
  await tracker?.stop();
  tracker = undefined;
});

/** An error raised at the frame this line describes, and nowhere else. */
function raisedAt(frame: string): Error {
  const error = new Error('the ledger is closed');

  error.stack = `Error: the ledger is closed\n${frame}`;

  return error;
}

/** Each frame, as a runtime or a bundler writes it, and the place it groups by: nothing when it cannot be read. */
const FRAMES: readonly (readonly [string, string])[] = [
  ['    at closeLedger (/app/ledger.js:12:7)', 'closeLedger ledger.js'],
  ['    at closeLedger (ledger.js:12:7)', 'closeLedger ledger.js'],
  ['    at async closeLedger (/app/ledger.js:12:7)', 'closeLedger ledger.js'],
  ['    at Ledger.close (C:\\app\\ledger.js:12:7)', 'Ledger.close ledger.js'],
  ['    at /app/ledger.js:12:7', 'ledger.js'],
  ['    at ledger.js:12:7', 'ledger.js'],
  ['    at closeLedger (/app/ledger.js)', ''],
  ['    at closeLedger (/app/ledger.js:12)', ''],
  ['    at closeLedger (/app/ledger.js 12)', ''],
  ['    at closeLedger (/app/:12:7)', ''],
  ['    at node:internal:12:7', ''],
  ['    at  (ledger.js:12:7)', ''],
  ['    at async close\rLedger (/app/ledger.js:12:7)', ''],
  ['Error: not a frame at all', ''],
];

describe('the place an error is grouped by', () => {
  it('is the function and the file of the first frame it can read, whatever the form of the frame', async () => {
    tracker = await aTracker();

    for (const [index, [frame]] of FRAMES.entries()) {
      tracker.errors.report(raisedAt(frame), errorReportOf(undefined, { origin: 'http', operation: `frame-${index}` }));
    }

    await tracker.errors.flush(2_000);

    const placeOf = (index: number): string | undefined =>
      tracker?.server.events
        .find((event) => event.tags?.['operation'] === `frame-${index}`)
        ?.fingerprint?.slice(1)
        .join(' | ');

    expect(FRAMES.map((_, index) => placeOf(index))).toEqual(FRAMES.map(([, place]) => place));
  });
});
