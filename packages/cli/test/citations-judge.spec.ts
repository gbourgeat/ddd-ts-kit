import { describe, expect, it } from 'vitest';
import { config } from '../src/check/fixtures/config.js';
import { citationLine } from '../src/citations/citation-line.js';
import type { Evidence } from '../src/citations/evidence.js';
import { formatCitations } from '../src/citations/format-citations.js';
import { formatRemovals } from '../src/citations/format-removals.js';
import { historyOf } from '../src/citations/history-of.js';
import { judgePath } from '../src/citations/judge-path.js';
import { nameIndexOf } from '../src/citations/name-index-of.js';
import type { StaleCitation } from '../src/citations/stale-citation.js';
import { parseConfig } from '../src/config/index.js';
import { designLine } from '../src/worker/design-line.js';

const BILLING = 'src/contexts/billing';
const PORTS = `${BILLING}/application/ports`;

const DIFF = [
  `D\t${PORTS}/price-list.port.ts`,
  `R091\t${PORTS}/tax-table.port.ts\t${PORTS}/tax-rates.port.ts`,
  `A\t${PORTS}/discounts.port.ts`,
].join('\n');

function evidence(files: readonly string[]): Evidence {
  return {
    root: '.',
    config: parseConfig(JSON.parse(config())),
    index: nameIndexOf([], files),
    history: historyOf(DIFF, 'main'),
  };
}

const citing = { document: 'docs/architecture/reviews/billing.md', line: 3, contexts: ['billing', 'catalog'] };

const removed: StaleCitation = {
  rows: [],
  document: 'docs/architecture/reviews/billing.md',
  line: 3,
  cited: 'application/ports/price-list.port.ts',
  kind: 'path',
  state: 'removed',
  removedBy: { path: `${PORTS}/price-list.port.ts` },
  candidates: [{ name: `${PORTS}/prices.port.ts`, file: `${PORTS}/prices.port.ts`, evidence: 'renamed' }],
};

describe('a path a design cites', () => {
  it('is present when a file lies under the directory it names', () => {
    expect(judgePath('application/ports/', citing, evidence([`${PORTS}/discounts.port.ts`])).state).toBe('present');
  });

  it('is removed with the most recent removal under a directory, and offers no successor the code lost since', () => {
    expect(judgePath('src/contexts/billing/application/ports/', citing, evidence([]))).toEqual({
      state: 'removed',
      removedBy: { path: `${PORTS}/price-list.port.ts` },
      candidates: [],
    });

    expect(judgePath('application/ports/tax-table.port.ts', citing, evidence([])).candidates).toEqual([]);
  });

  it('is refused under the contexts directory when the tree has no place for it, planned elsewhere', () => {
    expect(judgePath(`${BILLING}/application/services/pricing.service.ts`, citing, evidence([])).state).toBe('refused');
    expect(judgePath('src/platform/auth/roles/roles.ts', citing, evidence([])).state).toBe('planned');
  });

  it('reads a change not committed yet: what it removes, renames and adds', () => {
    const { removals, added } = historyOf(DIFF, 'main');

    expect([...removals.values()].map(({ path, before, renamedTo }) => ({ path, before, renamedTo }))).toEqual([
      { path: `${PORTS}/price-list.port.ts`, before: 'main', renamedTo: undefined },
      { path: `${PORTS}/tax-table.port.ts`, before: 'main', renamedTo: `${PORTS}/tax-rates.port.ts` },
    ]);

    expect([...added.keys()]).toEqual([`${PORTS}/tax-rates.port.ts`, `${PORTS}/discounts.port.ts`]);
  });
});

describe('what a report says of a name', () => {
  it('names a renamed path once, and a close name of a file without a role', () => {
    expect(citationLine(removed, 'main')).toBe(
      `docs/architecture/reviews/billing.md:3 \`application/ports/price-list.port.ts\`: removed by this change; now \`${PORTS}/prices.port.ts\` (renamed)`,
    );

    const similar: StaleCitation = {
      ...removed,
      cited: 'PriceListService',
      state: 'similar',
      candidates: [
        {
          name: 'PriceListGateway',
          file: `${BILLING}/infrastructure/external/price-list-gateway.ts`,
          evidence: 'same-stem',
        },
      ],
    };

    expect(citationLine(similar, 'main')).toContain('main has `PriceListGateway` (file): build on it');
  });

  it('counts the rows past five, says when no row is checked, and adds its notes', () => {
    const report = {
      base: 'main',
      commit: 'abc1234',
      counts: { present: 0, planned: 0 },
      citations: [removed],
      notes: ['a note'],
    };

    expect(formatCitations(report, ['1', '2', '3', '4', '5', '6'])).toContain(
      'Names of the design of 6 rows that main',
    );

    expect(formatCitations(report, [])).toContain('Names of the design of no row that main');
    expect(formatCitations(report, ['1']).endsWith('note: a note')).toBe(true);
    expect(formatRemovals([removed], 'main')).toContain('(renamed)');
    expect(formatRemovals([removed], 'main')).not.toContain('(#');
  });

  it('names a whole document under a row of the briefing', () => {
    const row = {
      id: 'M2.03',
      context: 'billing',
      kind: 'slice',
      slice: 'Price',
      startWith: '',
      dependsOn: [],
      owner: 'billing',
      status: 'todo',
      rules: undefined,
    };

    expect(designLine({ ...row, design: [{ document: 'docs/architecture/plan.md' }] })).toEqual([
      '  design: docs/architecture/plan.md',
    ]);
  });
});
