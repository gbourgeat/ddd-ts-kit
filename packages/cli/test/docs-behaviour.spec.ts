import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { behaviourPage } from '../src/docs/behaviour-page';
import { rulesIn } from '../src/docs/rules-in';
import { specOfPage } from '../src/docs/spec-of-page';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers';

describe('rulesIn, the rules a spec states', () => {
  it('reads the it titles under their describe, nested as the file nests them, the planned ones said so', () => {
    const rules = rulesIn(`describe('Slot', () => {
  it('is equal to another slot with the same instants', () => {});
  describe('when it ends', () => {
    it.todo('frees its calendar');
    it('is over', () => {});
  });
});
it('stands alone', () => {});
`);

    expect(rules.rules.map((rule) => rule.title)).toEqual(['stands alone']);
    expect(rules.groups).toHaveLength(1);

    const slot = rules.groups[0];

    expect(slot?.title).toBe('Slot');

    expect(slot?.rules.map((rule) => [rule.title, rule.state])).toEqual([
      ['is equal to another slot with the same instants', 'stated'],
    ]);

    expect(slot?.groups[0]?.title).toBe('when it ends');

    expect(slot?.groups[0]?.rules.map((rule) => [rule.title, rule.state, rule.line])).toEqual([
      ['frees its calendar', 'planned', 4],
      ['is over', 'stated', 5],
    ]);
  });

  it('reads a table of cases as one rule, a test call as an it, a spec put aside as such, and skips a title that is no literal', () => {
    const rules = rulesIn(`describe('Slot', () => {
  it.each([['ends when it starts', 1], ['ends before it starts', 2]] as const)('refuses a slot that %s', () => {});
  test('counts', () => {});
  it.skip('waits', () => {});
  describe(Slot.name, () => {
    it('has no literal title above', () => {});
  });
});
`);

    const slot = rules.groups[0];

    expect(slot?.rules.map((rule) => [rule.title, rule.state])).toEqual([
      ['refuses a slot that %s', 'stated'],
      ['counts', 'stated'],
      ['waits', 'aside'],
      ['has no literal title above', 'stated'],
    ]);

    expect(slot?.groups).toEqual([]);
  });
});

describe('behaviourPage, the rows of the plan a rule serves', () => {
  const titles = [
    '#FIX1 escalates to the next person, #FIX2 included',
    '#US1.04 AC1 a member declares an incident and gets 201',
    '#US1.04 #US1.05 AC2, AC3: lists them',
    'AC4 keeps AC4 inside',
    'is never issued twice',
    '#FIX1',
  ];

  const source = titles.map((title) => `it('${title}', () => {});`).join('\n');

  const page = behaviourPage('Billing', 'intro', [
    { title: 'unit', entries: [{ heading: 'a', specs: [specOfPage('a.spec.ts', rulesIn(source))] }] },
  ]);

  it('shows the rows and the criteria a title opens with before the rule, and keeps the rest of the title as it is', () => {
    expect(page).toContain('- `#FIX1` escalates to the next person, #FIX2 included\n');
    expect(page).toContain('- `#US1.04 AC1` a member declares an incident and gets 201\n');
    expect(page).toContain('- `#US1.04 #US1.05 AC2, AC3` lists them\n');
    expect(page).toContain('- `AC4` keeps AC4 inside\n');
    expect(page).toContain('- is never issued twice\n');
    expect(page).toContain('- #FIX1\n');
  });

  it('ends with each row the titles open with and how many titles cite it, in the order of the plan', () => {
    expect(page).toMatch(
      /## Rows of the plan\n\n.*\n\n\| Row \| Titles \|\n\|---\|---\|\n\| `#FIX1` \| 2 \|\n\| `#US1.04` \| 2 \|\n\| `#US1.05` \| 1 \|\n$/,
    );
  });

  it('says so when no title cites a row yet', () => {
    const uncited = behaviourPage('Billing', 'intro', [
      {
        title: 'unit',
        entries: [{ heading: 'a', specs: [specOfPage('a.spec.ts', rulesIn("it('is due', () => {});"))] }],
      },
    ]);

    expect(uncited).toContain('## Rows of the plan\n\nNo title cites a row of `docs/architecture/slices.md` yet');
  });
});

describe('behaviourPage, the title of a table of cases', () => {
  const source = `describe.each(['a', 'b'])('AppointmentExportGateway, %s', () => {
  it('lists the rows', () => {});
  it.each(['x'])('refuses %s with 422', () => {});
  it.each(['x'])('accepts the kind %s', () => {});
  it.each(['x'])('gives the ranges of %s, %s, in the order', () => {});
  it.each(['x'])('refuses "%s", which it does not know', () => {});
});
describe.each(['a'])('%s, by cause', () => {
  it('keeps the oldest', () => {});
});
`;

  const page = behaviourPage('Analytics', 'intro', [
    { title: 'unit', entries: [{ heading: 'a', specs: [specOfPage('a.spec.ts', rulesIn(source))] }] },
  ]);

  it('shows no placeholder: (each case) at the end, each case inside a title or opening it', () => {
    expect(page).toContain('- **AppointmentExportGateway (each case)**\n');
    expect(page).toContain('  - refuses each case with 422\n');
    expect(page).toContain('  - accepts the kind (each case)\n');
    expect(page).toContain('  - gives the ranges of each case, in the order\n');
    expect(page).toContain('  - refuses "each case", which it does not know\n');
    expect(page).toContain('- **each case, by cause**\n');
    expect(page).not.toMatch(/%s/);
  });
});

describe('docs, the pages of what the tests state', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('behaviour');
    scaffoldEverything(root);
  });

  it('writes one page per context from its specs and the index, up to date right after the generators', () => {
    expect(cli(root, 'docs', '--check').code).toBe(0);

    const page = read(root, 'docs/behaviour/billing.md');

    expect(page).toContain('# billing: what its tests state');
    expect(page).toContain('## Use cases');
    expect(page).toMatch(/\d+ rules? stated/);
    expect(page).toContain('(planned)');
    expect(read(root, 'docs/behaviour/README.md')).toContain('| [billing](billing.md) |');
  });

  it('reports the page stale once a spec changes, and reads the new title the next time', () => {
    write(
      root,
      'src/contexts/billing/test/unit/invoice-total.vo.spec.ts',
      "import { describe, it } from 'vitest';\n\ndescribe('InvoiceTotal', () => {\n  it('adds the lines of the invoice, taxes included', () => {});\n});\n",
    );

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('docs/behaviour/billing.md');
    expect(cli(root, 'docs').code).toBe(0);

    const page = read(root, 'docs/behaviour/billing.md');

    expect(page).toContain('### Invoice total (value object)');
    expect(page).toContain('`unit/invoice-total.vo.spec.ts`');
    expect(page).toContain('- **InvoiceTotal**\n  - adds the lines of the invoice, taxes included');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('writes the pages alone with --behaviour, every other generated document left as it is, and checks them alone', () => {
    const map = read(root, 'docs/context-map.md');

    write(
      root,
      'docs/context-map.md',
      map.replace('<!-- /ddd-ts-kit:context-map -->', 'edited by hand\n<!-- /ddd-ts-kit:context-map -->'),
    );

    write(
      root,
      'src/contexts/billing/test/unit/invoice-due.vo.spec.ts',
      "import { describe, it } from 'vitest';\n\ndescribe('InvoiceDue', () => {\n  it.todo('falls due thirty days after the issue');\n});\n",
    );

    expect(cli(root, 'docs', '--behaviour', '--check').code).toBe(1);
    expect(cli(root, 'docs', '--behaviour').code).toBe(0);
    expect(read(root, 'docs/behaviour/billing.md')).toContain('falls due thirty days after the issue (planned)');
    expect(read(root, 'docs/context-map.md')).toContain('edited by hand');

    expect(cli(root, 'docs', '--behaviour', '--check').stdout).toBe(
      'The pages of what the tests state are up to date.',
    );

    expect(cli(root, 'docs', '--check').code).toBe(1);
    expect(cli(root, 'docs').code).toBe(0);
  });

  it('writes no page for a dot folder of the contexts directory', () => {
    mkdirSync(path.join(root, 'src/contexts/.claude/.cc-writes'), { recursive: true });

    expect(cli(root, 'docs').code).toBe(0);
    expect(exists(root, 'docs/behaviour/.claude.md')).toBe(false);
    expect(read(root, 'docs/behaviour/README.md')).not.toContain('.claude');
    expect(cli(root, 'check').stdout).not.toContain('.claude');
  });

  it('deletes the page of a context that is gone', () => {
    rmSync(path.join(root, 'src/contexts/shipping'), { recursive: true, force: true });

    expect(cli(root, 'docs').code).toBe(0);
    expect(exists(root, 'docs/behaviour/shipping.md')).toBe(false);
    expect(read(root, 'docs/behaviour/README.md')).not.toContain('shipping.md');
  });
});
