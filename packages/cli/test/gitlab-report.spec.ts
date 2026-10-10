import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, REPO_ROOT, scaffoldEverything, tempDir, write } from './helpers.js';
import { jsonAt } from './support/json-at.js';

const CONVERTER = path.join(REPO_ROOT, 'pipeline/gitlab/arch-to-codequality.mjs');
const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';

describe('check --format gitlab', () => {
  it('prints the Code Quality report the converter of the pipeline would write, fingerprints included', () => {
    const root = brokenProject();
    const direct = cli(root, 'check', '--format', 'gitlab');
    const report = direct.json();
    const issues: readonly unknown[] = Array.isArray(report) ? report : [];
    const purity = issues.find((issue) => jsonAt(issue, 'check_name') === 'layer/domain-purity');

    expect(direct.code).toBe(1);
    expect(issues.length).toBeGreaterThan(4);
    expect(issues).toEqual(converted(root));
    expect(new Set(issues.map((issue) => jsonAt(issue, 'fingerprint'))).size).toBe(issues.length);
    expect(purity).toMatchObject({ severity: 'major', location: { path: AGGREGATE, lines: { begin: 1 } } });
  });

  it('prints an empty report for a clean project', () => {
    const root = tempDir('gitlab');

    scaffoldEverything(root);

    expect(cli(root, 'check', '--format', 'gitlab').json()).toEqual([]);
  });
});

/** A generated project with a few violations of the domain layer in it. */
function brokenProject(): string {
  const root = tempDir('gitlab');

  scaffoldEverything(root);
  write(root, AGGREGATE, `import { z } from 'zod';\nimport { v4 } from 'uuid';\n${read(root, AGGREGATE)}\nexport const shapes = [z, v4, z];\n// const old = 1;\n`);
  write(root, 'src/contexts/billing/domain/aggregates/Wrong.ts', 'export class Wrong {}\n');

  return root;
}

/** What the converter of the pipeline writes from the JSON report of the checker. */
function converted(root: string): unknown {
  write(root, 'reports/arch.json', cli(root, 'check', '--format', 'json').stdout);

  try {
    execFileSync(process.execPath, [CONVERTER, 'reports/arch.json', 'reports/converted.json'], { cwd: root, stdio: 'pipe' });
  } catch {
    // The converter exits 1 while errors remain; the report is written all the same.
  }

  const report: unknown = JSON.parse(read(root, 'reports/converted.json'));

  return report;
}
