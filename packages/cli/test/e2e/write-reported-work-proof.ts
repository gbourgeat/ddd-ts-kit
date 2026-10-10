import fs from 'node:fs';
import path from 'node:path';
import { write } from '../helpers.js';

export const REPORTED_WORK_PROOF = 'src/reported-work.spec.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures/reported-work.spec.ts.txt');

/**
 * Writes the spec that holds the first-class project to what it reports outside of a request,
 * on the reporter in memory of its test application: a job whose command fails, and an event
 * the outbox relay of the project gives up.
 */
export function writeReportedWorkProof(root: string): void {
  write(root, REPORTED_WORK_PROOF, fs.readFileSync(FIXTURE, 'utf8'));
}
