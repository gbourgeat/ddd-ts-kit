import fs from 'node:fs';
import path from 'node:path';
import { read, write } from '../helpers.js';

export const REPORTED_FAILURES_PROOF = 'src/reported-failures.spec.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures/reported-failures.spec.ts.txt');
const HANDLER = 'src/contexts/ordering/application/queries/track-order/track-order.handler.ts';
const READS = '    return this.reader.read(query);';
const FAILS = "    throw new Error('The projection of ' + query.constructor.name + ' is unavailable.');";

/**
 * Makes the one query of the project fail with something nobody planned, and writes the spec
 * that holds the application to what it then reports: once, to a reporter in memory; nothing
 * without a DSN; one scrubbed event to an endpoint of the loopback interface with one.
 */
export function writeReportedFailuresProof(root: string): void {
  const handler = read(root, HANDLER);

  if (!handler.includes(READS)) {
    throw new Error(`${HANDLER} no longer reads through its reader: update the proof.`);
  }

  write(root, HANDLER, handler.replace(READS, FAILS));
  write(root, REPORTED_FAILURES_PROOF, fs.readFileSync(FIXTURE, 'utf8'));
}
