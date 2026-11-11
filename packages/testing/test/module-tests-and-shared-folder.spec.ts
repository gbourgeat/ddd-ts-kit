import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { levelOf } from '../src/budget';
import { governedCoverage, REFERENCE_COVERAGE } from '../src/coverage';
import { governedMutation } from '../src/mutation';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-shared-folder-'));
const SCHEDULING = 'src/contexts/scheduling';
const IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A context divided into modules as it is to be laid out: each module with its tests, and `shared/` for what belongs to none. */
const LAID_OUT = [
  `${SCHEDULING}/calendars/domain/aggregates/calendar.aggregate.ts`,
  `${SCHEDULING}/calendars/test/unit/calendar.aggregate.spec.ts`,
  `${SCHEDULING}/calendars/test/builders/calendar.builder.ts`,
  `${SCHEDULING}/calendars/test/fakes/calendar.repository.fake.ts`,
  `${SCHEDULING}/shared/infrastructure/persistence/scheduling.schema.ts`,
  `${SCHEDULING}/shared/presentation/http/calendars.routes.ts`,
  `${SCHEDULING}/shared/test/worlds/scheduling.world.ts`,
];

function projectWith(files: readonly string[]): string {
  const root = mkdtempSync(path.join(workspace, 'project-'));

  writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), '{}');
  files.forEach((file) => writeTo(root, file, 'export const written = true;\n'));

  return root;
}

function writeTo(root: string, file: string, content: string): void {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

/** Whether a mutation run of a change of `file` runs everything, in a project committed as it is to be laid out. */
function forcedBy(file: string): boolean {
  const root = projectWith(LAID_OUT);

  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    ['commit', '-q', '-m', 'the project'],
  ]) {
    execFileSync('git', [...IDENTITY, ...args], { cwd: root, stdio: 'ignore' });
  }

  writeTo(root, file, 'export const changed = true;\n');
  vi.stubEnv('DDD_TS_KIT_MUTATION_SINCE', 'HEAD');

  return governedMutation(root).force;
}

describe('a context whose modules hold their tests, with a shared folder, as the test tooling reads it', () => {
  it('holds the layers of shared to the floor of their layer, and measures no test folder', () => {
    const { thresholds, include } = governedCoverage('test', projectWith(LAID_OUT));

    expect(thresholds).toEqual({
      [`${SCHEDULING}/calendars/domain/**/*.ts`]: REFERENCE_COVERAGE.domain,
      [`${SCHEDULING}/shared/infrastructure/**/*.ts`]: REFERENCE_COVERAGE.infrastructure,
      [`${SCHEDULING}/shared/presentation/**/*.ts`]: REFERENCE_COVERAGE.presentation,
    });

    // A layer, at the level of the context or one folder below: never the test folder of a module nor of shared.
    expect(include.filter((glob) => glob.includes('test'))).toEqual([]);
    expect(include.every((glob) => /^src\/contexts\/\*\/(?:\*\/)?[a-z]+\/\*\*\/\*\.ts$/.test(glob))).toBe(true);
  });

  it('holds an integration spec of a module or of shared to the integration budget, a unit spec to the unit one', () => {
    expect(levelOf(`${SCHEDULING}/calendars/test/integration/calendar.repository.contract.spec.ts`)).toBe(
      'integration',
    );

    expect(levelOf(`${SCHEDULING}/calendars/test/unit/calendar.aggregate.spec.ts`)).toBe('unit');
    expect(levelOf(`${SCHEDULING}/shared/test/worlds/scheduling.world.spec.ts`)).toBe('unit');
  });

  it('reads a change of the model of a module fast, and runs every mutant again for what its tests lean on', () => {
    expect(forcedBy(`${SCHEDULING}/calendars/domain/aggregates/calendar.aggregate.ts`)).toBe(false);
    expect(forcedBy(`${SCHEDULING}/calendars/test/unit/calendar.aggregate.spec.ts`)).toBe(false);
    expect(forcedBy(`${SCHEDULING}/calendars/test/builders/calendar.builder.ts`)).toBe(true);
    expect(forcedBy(`${SCHEDULING}/calendars/test/fakes/calendar.repository.fake.ts`)).toBe(true);
    expect(forcedBy(`${SCHEDULING}/shared/test/worlds/scheduling.world.ts`)).toBe(true);
    expect(forcedBy(`${SCHEDULING}/shared/infrastructure/persistence/scheduling.schema.ts`)).toBe(true);
  });
});
