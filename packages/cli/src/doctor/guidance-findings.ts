import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config/index.js';
import { REVIEW_POLICY } from '../init/files/guidance-files.js';
import { PROFILE_HOOKS } from '../init/profile-hooks.js';
import type { DoctorFinding } from './doctor-finding.js';

/**
 * The guidance this version writes once and the team then owns: the review policy, `REVIEW.md`,
 * which the reviewer agent, a human reviewer and any review bot read, and under the regulated
 * profile the two hooks of `.claude/hooks/`. Judged present or missing only: what they say is the team's.
 */
export function guidanceFindings(root: string, config: Config): DoctorFinding[] {
  const [policy] = REVIEW_POLICY;
  const hooks = config.agents.profile === 'regulated' ? PROFILE_HOOKS.map((hook) => hook.file) : [];

  return [policy, ...hooks]
    .filter((file) => !fs.existsSync(path.join(root, file)))
    .map((file) => ({ area: 'guidance', name: file, problem: 'missing', expected: 'the file init writes' }));
}
