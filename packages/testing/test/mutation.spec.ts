import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

    expect(governed.plugins).toEqual([
      '@stryker-mutator/*',
      expect.stringMatching(/^file:\/\/\/.+\/mutation\/refusal-texts-ignorer\.js$/),
    ]);

    expect(governed.ignorers).toEqual(['refusal-texts']);
    expect(governed.ignoreStatic).toBe(true);
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
