import { describe, expect, it } from 'vitest';
import { plannedCommands } from '../src/plan/planned-commands';

describe('the generator commands of a Start with cell', () => {
  it('reads each command between backquotes, with or without npx ddd-ts-kit, its quoted values as one argument', () => {
    expect(
      plannedCommands(
        '`npx ddd-ts-kit generate command billing IssueInvoice --term "Issue=Send an invoice"`; then `g route billing IssueInvoice --method POST`',
      ),
    ).toEqual([
      {
        text: 'generate command billing IssueInvoice --term "Issue=Send an invoice"',
        argv: ['command', 'billing', 'IssueInvoice', '--term', 'Issue=Send an invoice'],
      },
      {
        text: 'generate route billing IssueInvoice --method POST',
        argv: ['route', 'billing', 'IssueInvoice', '--method', 'POST'],
      },
    ]);
  });

  it('reads a value quoted after its flag, and holds no command in a cell that runs no generator', () => {
    expect(plannedCommands("`generate job billing Remind --cron='0 9 * * 1-5'`")[0]?.argv).toEqual([
      'job',
      'billing',
      'Remind',
      '--cron=0 9 * * 1-5',
    ]);

    expect(plannedCommands('none: a snapshot policy (`testing` skill), then `acceptance US1 --gate written`')).toEqual(
      [],
    );
  });
});
