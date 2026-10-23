import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { ignoreCodeTypesWhereTheyAre } from '../src/knip';
import { Workspace } from '../src/workspace';
import { read, tempDir, write } from './helpers';

const ROOT = 'src/contexts/*/*.codes.ts';
const EARLIER = 'src/contexts/*/domain/errors/codes.ts';
const LIST = "export const BillingCodes = { InvoiceVoid: 'INVOICE_VOID' } as const;\n";

/** A project whose contexts hold their code lists at `lists`, knip told of `issues`; answers what became of knip.json. */
function aligned(lists: readonly string[], issues: unknown): { said: string; knip: string } {
  const root = tempDir('knip-code-types');

  lists.forEach((file) => write(root, file, LIST));
  write(root, 'knip.json', typeof issues === 'string' ? issues : `${JSON.stringify(issues, null, 2)}\n`);

  const ws = new Workspace(root, false);
  const said = ignoreCodeTypesWhereTheyAre(ws, parseConfig({}));

  ws.commit(false);

  return { said, knip: read(root, 'knip.json') };
}

describe('the code types knip is told of', () => {
  it('are named at the root and where 0.86 kept them, as long as one context still holds a list there', () => {
    const { said, knip } = aligned(
      ['src/contexts/billing/domain/errors/codes.ts', 'src/contexts/sales/sales.codes.ts'],
      { project: ['src/**/*.ts'], ignoreIssues: { [EARLIER]: ['types'], 'src/a.ts': ['exports'] } },
    );

    expect(said).toBe('rewritten');

    expect(Object.keys(JSON.parse(knip).ignoreIssues)).toEqual([ROOT, EARLIER, 'src/a.ts']);
  });

  it('are named at the root alone once no context holds a list where 0.86 kept it', () => {
    const { said, knip } = aligned(['src/contexts/billing/billing.codes.ts'], {
      ignoreIssues: { 'src/a.ts': ['exports'], [EARLIER]: ['types'], [ROOT]: ['types'] },
    });

    expect(said).toBe('rewritten');
    expect(JSON.parse(knip).ignoreIssues).toEqual({ 'src/a.ts': ['exports'], [ROOT]: ['types'] });
  });

  it('are left alone in a config that tells knip of none, already right, or not plain JSON', () => {
    expect(aligned(['src/contexts/billing/billing.codes.ts'], { project: ['src/**/*.ts'] }).said).toBe('unchanged');

    expect(aligned(['src/contexts/billing/billing.codes.ts'], { ignoreIssues: { [ROOT]: ['types'] } }).said).toBe(
      'unchanged',
    );

    expect(aligned([], '{ // a comment\n}\n').said).toBe('unreadable');
  });
});
