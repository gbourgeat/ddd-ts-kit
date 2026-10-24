import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { governedMutation, mutationSettings, REFERENCE_MUTATION } from '../src/mutation';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-mutation-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** A project on disk: its config file, given from its root. */
function projectWith(config: object): string {
  const root = mkdtempSync(path.join(workspace, 'project-'));

  writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));

  return root;
}

const IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];

/** A project under git, its files committed; what is written afterwards is the change. */
function committedProject(): string {
  const root = projectWith({});

  writeTo(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts', 'export class Invoice {}\n');
  writeTo(root, 'src/contexts/billing/test/builders/invoice.builder.ts', 'export class InvoiceBuilder {}\n');

  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    ['commit', '-q', '-m', 'the project'],
  ]) {
    execFileSync('git', [...IDENTITY, ...args], { cwd: root, stdio: 'ignore' });
  }

  return root;
}

function writeTo(root: string, file: string, content: string): void {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

/** The run of a change reads its base from the environment, as the job of a pull request sets it. */
function readingAChange<T>(since: string | undefined, run: () => T): T {
  const kept = process.env['DDD_TS_KIT_MUTATION_SINCE'];

  if (since === undefined) {
    delete process.env['DDD_TS_KIT_MUTATION_SINCE'];
  } else {
    process.env['DDD_TS_KIT_MUTATION_SINCE'] = since;
  }

  try {
    return run();
  } finally {
    if (kept === undefined) {
      delete process.env['DDD_TS_KIT_MUTATION_SINCE'];
    } else {
      process.env['DDD_TS_KIT_MUTATION_SINCE'] = kept;
    }
  }
}

describe('governedMutation(), what a Stryker run mutates and is held to', () => {
  it('mutates the domain layer of every context, at its level and in its modules, the generated declarations and the specs left out', () => {
    const governed = governedMutation(projectWith({}));

    expect(governed.mutate).toEqual([
      'src/contexts/**/domain/**/*.ts',
      '!src/contexts/**/*.declarations.ts',
      '!**/*.spec.ts',
    ]);
  });

  it('leaves the texts of refusals out through the ignorer of the kit, since a refusal is asserted by its code and never by its text, and ignores the static mutants', () => {
    const governed = governedMutation(projectWith({}));

    expect(governed.appendPlugins).toEqual([
      expect.stringMatching(/^file:\/\/\/.+\/mutation\/refusal-texts-ignorer\.js$/),
    ]);

    expect(governed.ignorers).toEqual(['refusal-texts']);
    expect(governed.ignoreStatic).toBe(true);
  });

  it('runs everything by default, the truth of the night, with the incremental file beside the report', () => {
    const governed = readingAChange(undefined, () => governedMutation(projectWith({})));

    expect(governed.incremental).toBe(false);
    expect(governed.force).toBe(false);
    expect(governed.incrementalFile).toBe('reports/mutation/incremental.json');
  });

  it('reads a change incrementally when its base is given, reusing the last report for what the change leaves alone', () => {
    const root = committedProject();

    writeTo(
      root,
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      'export class Invoice { paid = false; }\n',
    );

    writeTo(root, 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts', 'export {};\n');
    writeTo(root, 'docs/architecture/decisions/0002-invoices.md', '# Invoices\n');

    const governed = readingAChange('HEAD', () => governedMutation(root));

    expect(governed.incremental).toBe(true);
    expect(governed.force).toBe(false);
  });

  it('forces the whole run when the change touches what the tests lean on, which Stryker does not diff', () => {
    const root = committedProject();

    writeTo(
      root,
      'src/contexts/billing/test/builders/invoice.builder.ts',
      'export class InvoiceBuilder { paid() {} }\n',
    );

    expect(readingAChange('HEAD', () => governedMutation(root))).toMatchObject({ incremental: true, force: true });

    expect(readingAChange('HEAD', () => governedMutation(projectWith({})))).toMatchObject({
      incremental: true,
      force: true,
    });
  });

  it('holds the run to the floor of the reference when the config says nothing', () => {
    expect(governedMutation(projectWith({})).thresholds).toEqual({ high: 80, low: 80, break: 80 });
    expect(REFERENCE_MUTATION.domain).toBe(80);
  });

  it('holds the run to the floor the config writes, and colours a score above it as good', () => {
    expect(governedMutation(projectWith({ mutation: { domain: 95 } })).thresholds).toEqual({
      high: 95,
      low: 95,
      break: 95,
    });

    expect(governedMutation(projectWith({ mutation: { domain: 60 } })).thresholds).toEqual({
      high: 80,
      low: 60,
      break: 60,
    });
  });

  it('reads the contexts directory of the config, and the reference for a floor that is not a percentage', () => {
    const root = projectWith({ contextsDir: 'modules', mutation: { domain: 'high' } });

    expect(mutationSettings(root)).toEqual({ contextsDir: 'modules', domain: 80 });
    expect(governedMutation(root).mutate[0]).toBe('modules/**/domain/**/*.ts');
  });

  it('refuses a project without a config file, naming it', () => {
    const root = mkdtempSync(path.join(workspace, 'bare-'));

    expect(() => governedMutation(root)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('ddd-ts-kit.config.json') }),
    );
  });
});
