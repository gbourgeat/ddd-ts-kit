import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { renderCruiseFile } from '../src/depcruise/render-cruise-file';
import { REPO_ROOT, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/background/compile-statements.background-job.ts`;
const NEXT_TO_IT = `${BILLING}/application/background/statements.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;

const SCHEMA_IMPORTS =
  "import { z } from 'zod';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';\nexport { z, zodSchema };\n";

describe('the dependency-cruiser file init writes, on a background job', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('depcruise-job');

    const config = parseConfig({ stack: { validation: 'zod' }, contexts: { billing: { classification: 'core' } } });

    write(root, '.dependency-cruiser.cjs', renderCruiseFile(config));

    write(
      root,
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } }),
    );

    write(root, JOB, `${SCHEMA_IMPORTS}import type { Knex } from 'knex';\nexport type K = Knex;\n`);
    write(root, NEXT_TO_IT, SCHEMA_IMPORTS);
    write(root, HANDLER, SCHEMA_IMPORTS);
  });

  it('lets the job import the validation library of its payload schema, and nothing more', () => {
    expect(violationsOf(root, JOB)).toEqual(['layer-application-inward: knex']);
  });

  it('refuses that library to any other file of the application layer, next to the job or in a handler', () => {
    const refused = ['layer-application-inward: @ddd-ts-kit/validation/zod', 'layer-application-inward: zod'];

    expect([violationsOf(root, NEXT_TO_IT), violationsOf(root, HANDLER)]).toEqual([refused, refused]);
  });
});

/** The module of each layer violation dependency-cruiser reports for the imports of one file, by rule, sorted. */
function violationsOf(root: string, file: string): string[] {
  const depcruise = path.join(REPO_ROOT, 'node_modules/.bin/depcruise');
  const args = [file, '--config', '.dependency-cruiser.cjs', '--output-type', 'json'];
  const { stdout } = spawnSync(depcruise, args, { cwd: root, encoding: 'utf8' });
  const { summary } = JSON.parse(stdout) as { summary: { violations: { rule: { name: string }; to: string }[] } };

  return summary.violations
    .filter((violation) => violation.rule.name.startsWith('layer-'))
    .map((violation) => `${violation.rule.name}: ${violation.to}`)
    .sort();
}
