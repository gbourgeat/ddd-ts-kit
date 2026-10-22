import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_POLICY } from '../init/files/guidance-files.js';
import type { DoctorFinding } from './doctor-finding.js';

/**
 * The guidance this version writes once and the team then owns: the review policy, `REVIEW.md`,
 * which the reviewer agent, a human reviewer and any review bot read. Judged present or missing
 * only: what it says is the team's.
 */
export function guidanceFindings(root: string): DoctorFinding[] {
  const [file] = REVIEW_POLICY;

  return fs.existsSync(path.join(root, file))
    ? []
    : [{ area: 'guidance', name: file, problem: 'missing', expected: 'the file init writes' }];
}
