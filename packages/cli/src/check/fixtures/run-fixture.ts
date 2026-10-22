import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCheck } from '../engine/run-check';
import type { Violation } from '../model/violation';
import { loadProject } from '../project/load-project';
import type { Fixture } from './fixture';

export interface FixtureOutcome {
  readonly fixture: Fixture;
  readonly ok: boolean;
  readonly detail: string;
  readonly violations: readonly Violation[];
}

/** Writes the mini-project to a temporary directory, checks it with every rule and says whether the rule behaved. */
export function runFixture(fixture: Fixture): FixtureOutcome {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-fixture-'));

  try {
    writeFiles(root, fixture.files);

    const { violations } = runCheck(loadProject(root));
    const verdict = judge(fixture, violations);

    return { fixture, ok: verdict === undefined, detail: verdict ?? summary(fixture, violations), violations };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeFiles(root: string, files: Fixture['files']): void {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

/** What went wrong, or undefined when the rule behaved as the fixture expects. */
function judge(fixture: Fixture, violations: readonly Violation[]): string | undefined {
  const listed = violations.map((violation) => `${violation.ruleId} at ${violation.file}:${violation.line}`).join('; ');

  if (fixture.expect === 'pass') {
    return violations.length === 0 ? undefined : `expected no violation, got ${listed}`;
  }

  const { file } = fixture.expect;
  const hit = violations.find((violation) => violation.ruleId === fixture.ruleId && violation.file === file);

  if (hit === undefined) {
    return `expected ${fixture.ruleId} at ${file}, got ${listed || 'nothing'}`;
  }

  if (hit.fix.trim() === '') {
    return 'the violation carries no fix';
  }

  const stray = violations.filter(
    (violation) => violation.ruleId !== fixture.ruleId && fixture.also?.includes(violation.ruleId) !== true,
  );

  return stray.length === 0
    ? undefined
    : `other rules fired: ${stray.map((violation) => `${violation.ruleId} at ${violation.file}:${violation.line}`).join(', ')}`;
}

function summary(fixture: Fixture, violations: readonly Violation[]): string {
  const hit = violations.find((violation) => violation.ruleId === fixture.ruleId);

  return hit === undefined ? 'no violation' : `${hit.ruleId} at ${hit.file}:${hit.line}`;
}
