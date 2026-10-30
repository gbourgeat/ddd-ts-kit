import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core');

  cli(
    root,
    'generate',
    'aggregate',
    'billing',
    'Invoice',
    '--term',
    'Invoice=What a customer owes',
    '--term',
    'Pay=Settle an invoice',
  );
});

describe('plan-waves, the names of the planned commands', () => {
  const plan = (rows: string): ReturnType<typeof cli> => {
    write(root, 'docs/architecture/slices.md', `${HEADER}${rows}`);

    return cli(root, 'plan-waves', '--json');
  };

  it('replays the commands in a copy and refuses, with no wave, a name the glossary of its context does not hold', () => {
    const refused = plan(
      '| US4.01 | billing | slice | Refund invoice | `generate command billing RefundInvoice --aggregate Invoice --permission invoice.refund` | | billing | todo |\n',
    );

    expect(refused.code).toBe(1);

    expect(refused.json()).toMatchObject({
      problems: [
        {
          kind: 'undefined-word',
          rows: ['US4.01'],
          message:
            '#US4.01 `generate command billing RefundInvoice --aggregate Invoice --permission invoice.refund`: "RefundInvoice" uses "refund", which the glossary of billing does not define: add --term "Refund=<what it means for the business>" to this row or to a row it depends on',
        },
      ],
      waves: [],
    });

    expect(fs.existsSync(path.join(root, 'src/contexts/billing/application/commands/refund-invoice'))).toBe(false);
  });

  it('counts the terms of the row and of the rows it waits for, not those of a row it does not wait for', () => {
    const term = '--term "Refund=Give back what a customer paid"';
    const refund = '`generate command billing RefundInvoice --aggregate Invoice --permission invoice.refund`';

    expect(
      plan(`| US4.01 | billing | slice | Refund invoice | ${refund.replace(/`$/, ` ${term}\``)} | | billing | todo |\n`)
        .code,
    ).toBe(0);

    expect(
      plan(
        `| US4.01 | billing | skeleton | Refund | \`generate value-object billing Refund ${term}\` | | billing | todo |\n| US4.02 | billing | slice | Refund invoice | ${refund} | US4.01 | billing | todo |\n`,
      ).code,
    ).toBe(0);

    const unrelated = plan(
      `| US4.01 | billing | skeleton | Refund | \`generate value-object billing Refund ${term}\` | | billing | todo |\n| US4.02 | billing | slice | Refund invoice | ${refund} | | billing | todo |\n`,
    );

    expect(unrelated.code).toBe(1);
    expect(jsonAt(unrelated.json(), 'problems')).toEqual([expect.objectContaining({ rows: ['US4.02'] })]);
  });

  it('does not judge the names of a row in progress: its worker may have added the term on their branch', () => {
    const refund = (status: string): string =>
      `| US4.01 | billing | slice | Refund invoice | \`generate command billing RefundInvoice --aggregate Invoice --permission invoice.refund\` | | billing | ${status} |\n`;

    const started = plan(refund('in progress'));

    expect(jsonAt(started.json(), 'problems')).toEqual([]);
    expect(started.code).toBe(0);
    expect(plan(refund('todo')).code).toBe(1);
  });

  it('reads no term from a command the generator cannot parse, which the replay refuses for its option', () => {
    const refused = plan(
      '| US4.01 | billing | slice | Refund invoice | `generate command billing RefundInvoice --aggregate Invoice --public --bogus --term "Refund=Give back"` | | billing | todo |\n',
    );

    expect(refused.code).toBe(1);

    const problems = jsonAt(refused.json(), 'problems');

    expect(Array.isArray(problems) ? problems.map((problem) => jsonAt(problem, 'kind')) : []).toEqual([
      'refused-command',
    ]);

    expect(JSON.stringify(problems)).toContain("Unknown option '--bogus'");
  });
});
