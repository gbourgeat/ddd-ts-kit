import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CliError } from '../src/cli-error';
import { replayed } from '../src/plan/replay';
import type { Slice } from '../src/progress/slice';
import { tempDir } from './helpers';

const ROW: Slice = {
  id: 'US1.01',
  context: 'billing',
  kind: 'slice',
  slice: 'Pay invoice',
  startWith: '`generate command billing PayInvoice`',
  dependsOn: [],
  owner: 'billing',
  status: 'todo',
};

describe('a replayed command refused by the generator', () => {
  it('says its refusal of the project, whether it names the copy as given or by its real path, and leaves a bare mention as it is', () => {
    const real = tempDir('replay-real');
    const copy = path.join(tempDir('replay-link'), 'copy');

    fs.symlinkSync(real, copy);

    const resolved = fs.realpathSync(copy);

    const refused = replayed(
      ROW,
      { text: 'generate command billing PayInvoice', argv: ['command', 'billing', 'PayInvoice'] },
      {
        copy,
        dryRun: true,
        generate: () => {
          throw new CliError(
            `Cannot read ${resolved}/src/contexts/billing/CONTEXT.md, nor ${copy}/src/contexts/billing/CONTEXT.md.`,
            `Run \`ddd-ts-kit generate command billing PayInvoice --dry-run --cwd ${resolved}\` in ${resolved}.`,
          );
        },
      },
    );

    expect(refused.refusal).toEqual({
      message: 'Cannot read src/contexts/billing/CONTEXT.md, nor src/contexts/billing/CONTEXT.md.',
      fix: `Run \`ddd-ts-kit generate command billing PayInvoice\` in ${resolved}.`,
      missing: false,
    });
  });

  it('records an error that is not a refusal of the generator without a fix, the copy named as given when it is gone', () => {
    const copy = path.join(tempDir('replay-gone'), 'copy');

    const failed = replayed(
      ROW,
      { text: 'generate command billing PayInvoice', argv: ['command', 'billing', 'PayInvoice'] },
      {
        copy,
        generate: () => {
          throw new Error(`EACCES: ${copy}/src/contexts/billing/CONTEXT.md`);
        },
      },
    );

    expect(failed.refusal).toEqual({
      message: 'EACCES: src/contexts/billing/CONTEXT.md',
      fix: null,
      missing: false,
    });
  });
});
