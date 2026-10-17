import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

const SPEC = 'test/acceptance/us5.acceptance.spec.ts';
const LOCK = 'test/acceptance/us5.acceptance.lock.json';
const STORY = 'docs/architecture/stories/US5.md';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | skeleton | Order | \`generate aggregate ordering Order\` | | conductor | done |
| US5.02 | ordering | slice | Place order | \`generate command ordering PlaceOrder --aggregate Order --permission order.place\` | US5.01 | ordering | todo |
| US5.03 | billing | slice | Invoice a customer's order | \`generate integration-handler billing ordering ordering.order.placed\` | US5.02 | billing | todo |
| US6.01 | ordering | slice | Cancel order | \`generate command ordering CancelOrder --aggregate Order --permission order.cancel\` | | ordering | done |
`;

const SPECIFICATION = `# US5 Order and invoice

## Acceptance criteria

- AC1: a customer places an order and reads its number
- AC2: the order placed is invoiced
  to its customer

## Decisions
`;

/** The spec of US5 once its scenarios are written, each in one of the forms a formatter leaves. */
const WRITTEN = `import { describe, it } from 'vitest';
import { expectStatus, pending } from '@ddd-ts-kit/testing/e2e';

describe('US5, acceptance', () => {
  it('#US5.02 AC1 a customer places an order and reads its number', pending(async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  }));

  it(
    "#US5.03 AC2 the customer's order is invoiced",
    pending(async () => {
      // An invoice is announced once the order is placed.
      expectStatus({ status: 404, headers: {}, body: undefined }, 201);
    }),
  );
});
`;

/** The same scenarios once their rows are built: the wrapper gone, the formatter run again. */
const BUILT = `import { describe, it } from 'vitest';
import { expectStatus } from '@ddd-ts-kit/testing/e2e';

describe('US5, acceptance', () => {
  it('#US5.02 AC1 a customer places an order and reads its number', async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  });

  it("#US5.03 AC2 the customer's order is invoiced", async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  });
});
`;

// One project for the whole file: each block takes the story where the previous one left it.
let root: string;

beforeAll(() => {
  root = initProject('--context', 'ordering:core', '--context', 'billing:supporting');
});

describe('generate acceptance', () => {
  it('refuses a story before its rows are planned', () => {
    const refused = cli(root, 'generate', 'acceptance', 'US5');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('No row of docs/architecture/slices.md belongs to US5.');
    expect(exists(root, SPEC)).toBe(false);
  });

  it('refuses what is not the code of a story', () => {
    write(root, 'docs/architecture/slices.md', SLICES);

    expect(cli(root, 'generate', 'acceptance', 'US5.02').stderr).toContain('"US5.02" is not the code of a story.');
  });

  it('writes the spec of a story without specification with an it.todo per slice row, its title quoted', () => {
    expect(cli(root, 'generate', 'acceptance', 'US5', 'Order and invoice', '--json').code).toBe(0);

    const spec = read(root, SPEC);

    expect(spec).toContain("describe('Order and invoice, acceptance', () => {");
    expect(spec).toContain("  it.todo('#US5.02 Place order');");
    expect(spec).toContain("  it.todo('#US5.03 Invoice a customer\\'s order');");
    expect(spec).not.toContain("it.todo('#US5.01");
    expect(spec).toContain("// Rows to cover: #US5.02 Place order, #US5.03 Invoice a customer's order.");
    expect(spec).toContain("from '$test/e2e/support/start-application'");
    expect(spec).toContain('// TODO(domain): replace each entry');
  });

  it('writes an it.todo per acceptance criterion once the story states them', () => {
    write(root, STORY, SPECIFICATION);

    expect(cli(root, 'generate', 'acceptance', 'US5', '--force').code).toBe(0);

    const spec = read(root, SPEC);

    expect(spec).toContain("  it.todo('AC1 a customer places an order and reads its number');");
    expect(spec).toContain("  it.todo('AC2 the order placed is invoiced to its customer');");
    expect(spec).not.toContain("it.todo('#US5.02");
  });
});

describe('the gates of an acceptance', () => {
  it('holds the story from the written gate while scenarios are left to write, and lets it pass without a gate', () => {
    const report = cli(root, 'acceptance', 'US5', '--gate', 'written');

    expect(report.code).toBe(1);
    expect(report.stdout).toContain(`US5  ${SPEC}\n  specification ${STORY}: 2 criteria, 2 named by a scenario`);
    expect(report.stdout).toContain('#US5.01 skeleton "Order" (done): no scenario needed');
    expect(report.stdout).toContain('#US5.02 slice "Place order" (todo): no scenario');

    expect(report.stdout).toMatch(
      /us5\.acceptance\.spec\.ts:\d+ {2}"AC1 a customer places an order and reads its number" is still an it\.todo/,
    );

    expect(report.stdout).toContain('#US5.02 Place order: no written scenario names it.');

    expect(report.stdout).toContain(
      `${STORY}:5  AC1 "a customer places an order and reads its number": no written scenario proves it.`,
    );

    expect(report.stdout).toContain('gate written: 6 left');
    expect(cli(root, 'acceptance', 'US5').code).toBe(0);
  });

  it('refuses to lock scenarios not written yet', () => {
    const refused = cli(root, 'acceptance', 'US5', '--lock');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('The acceptance of US5 is not written yet:');
    expect(exists(root, LOCK)).toBe(false);
  });

  it('asks for the lock once every slice and criterion has a written scenario, then meets the written gate', () => {
    write(root, SPEC, WRITTEN);

    const unlocked = cli(root, 'acceptance', 'US5', '--gate', 'written');

    expect(unlocked.code).toBe(1);
    expect(unlocked.stdout).toContain('#US5.02 slice "Place order" (todo): 1 scenario, 1 pending');
    expect(unlocked.stdout).toContain(`${LOCK}  The acceptance of US5 is not locked`);

    const locked = cli(root, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).toBe(`Locked 2 scenarios of US5 in ${LOCK}: commit it with them.`);

    expect(JSON.parse(read(root, LOCK))).toMatchObject({
      story: 'US5',
      criteria: { AC1: expect.any(String), AC2: expect.any(String) },
      scenarios: [
        { title: '#US5.02 AC1 a customer places an order and reads its number', criteria: ['AC1'] },
        { title: "#US5.03 AC2 the customer's order is invoiced", criteria: ['AC2'] },
      ],
      amendments: [],
    });

    const written = cli(root, 'acceptance', 'US5', '--gate', 'written');

    expect(written.code).toBe(0);
    expect(written.stdout).toContain(`US5  ${SPEC}, locked`);
    expect(written.stdout).toContain('gate written: met');
  });

  it('holds the passing gate while a scenario is pending', () => {
    const passing = cli(root, 'acceptance', 'US5', '--gate', 'passing', '--json');

    expect(passing.code).toBe(1);
    expect(passing.json()).toMatchObject({ gate: 'passing', met: false });

    expect(jsonAt(passing.json(), 'stories')).toEqual([
      expect.objectContaining({
        problems: [
          expect.objectContaining({ kind: 'pending', at: `${SPEC}:5`, from: 'passing' }),
          expect.objectContaining({ kind: 'pending', at: `${SPEC}:9`, from: 'passing' }),
        ],
      }),
    ]);
  });

  it('keeps the lock when the wrapper goes, comments and layout change: the scenarios assert the same', () => {
    write(root, SPEC, BUILT);

    const passing = cli(root, 'acceptance', 'US5', '--gate', 'passing');

    expect(passing.code).toBe(0);
    expect(passing.stdout).toContain('#US5.02 slice "Place order" (todo): 1 scenario, 1 active');
  });
});

describe('the lock of an acceptance', () => {
  it('reports a locked scenario changed while its criterion was not, whatever the gate, and refuses to lock it again without a reason', () => {
    write(root, SPEC, BUILT.replace('201);\n  });\n\n  it(', '200);\n  });\n\n  it('));

    const drifted = cli(root, 'acceptance', 'US5');

    expect(drifted.code).toBe(1);

    expect(drifted.stdout).toContain(
      `${LOCK}  "#US5.02 AC1 a customer places an order and reads its number" changed or disappeared since the lock, and no criterion it proves (AC1) changed`,
    );

    const refused = cli(root, 'acceptance', 'US5', '--lock');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Locked scenarios of US5 changed while no criterion they prove did');
    expect(refused.stderr).toContain('Never to make a test pass.');
  });

  it('locks a scenario that failed its criterion with the reason, kept as an amendment for the owner to validate', () => {
    const reason = 'AC1 says the order is placed: 201 Created, the scenario expected 200';
    const locked = cli(root, 'acceptance', 'US5', '--lock', '--reason', reason);

    expect(locked.code).toBe(0);

    expect(locked.stdout).toContain(
      `Amended, for the owner to validate: "#US5.02 AC1 a customer places an order and reads its number": ${reason}`,
    );

    expect(JSON.parse(read(root, LOCK))).toMatchObject({
      amendments: [
        {
          scenario: '#US5.02 AC1 a customer places an order and reads its number',
          criteria: ['AC1'],
          reason,
          on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      ],
    });

    const report = cli(root, 'acceptance', 'US5');

    expect(report.code).toBe(0);
    expect(report.stdout).toMatch(/amended on \d{4}-\d{2}-\d{2}, for the owner to validate: "#US5\.02 AC1/);
  });

  it('lets a scenario change with its criterion, asking only to lock again', () => {
    write(root, STORY, SPECIFICATION.replace('and reads its number', 'and reads its number and its total'));
    write(root, SPEC, read(root, SPEC).replace('201);\n  });\n});', '202);\n  });\n});').replace('200);', '201);'));

    const report = cli(root, 'acceptance', 'US5', '--gate', 'written');

    expect(report.code).toBe(1);
    expect(report.stdout).toContain('criterion AC1 changed');

    expect(report.stdout).toContain(
      '"#US5.02 AC1 a customer places an order and reads its number" changed with its criterion',
    );

    expect(report.stdout).not.toContain(
      '"#US5.02 AC1 a customer places an order and reads its number" changed or disappeared since the lock',
    );
  });

  it('reports the drift of the scenario of an unchanged criterion even then', () => {
    expect(cli(root, 'acceptance', 'US5').stdout).toContain(
      `"#US5.03 AC2 the customer's order is invoiced" changed or disappeared since the lock, and no criterion it proves (AC2) changed`,
    );
  });

  it('reports a locked scenario removed while its criterion stayed', () => {
    write(root, SPEC, BUILT.replace(/\n {2}it\("#US5\.03[^]*?\n {2}\}\);\n/, '\n'));

    expect(cli(root, 'acceptance', 'US5').stdout).toContain(
      `"#US5.03 AC2 the customer's order is invoiced" changed or disappeared since the lock`,
    );
  });
});

describe('what acceptance always reports', () => {
  it('reports a pending scenario whose rows are all done, one put aside, one without a row, an unknown row or criterion, whatever the gate', () => {
    write(root, 'docs/architecture/stories/us6.md', '## Acceptance criteria\n\n- AC1: a customer cancels an order\n');

    write(
      root,
      'test/acceptance/us6.acceptance.spec.ts',
      [
        "it('#US6.01 AC1 a customer cancels an order', pending(async () => {}));",
        "it.skip('#US6.01 AC1 a cancelled order is refunded', async () => {});",
        "it('AC1 a customer reads the cancellation', async () => {});",
        "it('#US6.09 AC1 a cancelled order is archived', async () => {});",
        "it('#US6.01 AC7 a cancelled order is announced', async () => {});",
        '',
      ].join('\n'),
    );

    const report = cli(root, 'acceptance', 'US6', '--json');

    expect(report.code).toBe(1);

    expect(jsonAt(report.json(), 'stories')).toEqual([
      expect.objectContaining({
        specification: 'docs/architecture/stories/us6.md',
        problems: [
          expect.objectContaining({ kind: 'done-pending', at: 'test/acceptance/us6.acceptance.spec.ts:1' }),
          expect.objectContaining({ kind: 'skipped', at: 'test/acceptance/us6.acceptance.spec.ts:2' }),
          expect.objectContaining({ kind: 'no-row', at: 'test/acceptance/us6.acceptance.spec.ts:3' }),
          expect.objectContaining({ kind: 'unknown-row', at: 'test/acceptance/us6.acceptance.spec.ts:4' }),
          expect.objectContaining({ kind: 'unknown-criterion', at: 'test/acceptance/us6.acceptance.spec.ts:5' }),
          expect.objectContaining({ kind: 'unlocked', from: 'written' }),
        ],
      }),
    ]);
  });

  it('lists every story of slices.md and every spec without a story', () => {
    write(root, 'test/acceptance/us9.acceptance.spec.ts', "it('#US9.01 something', async () => {});\n");

    const all = cli(root, 'acceptance', '--gate', 'written');

    expect(all.stdout).toContain(`US5  ${SPEC}`);
    expect(all.stdout).toContain('US6  test/acceptance/us6.acceptance.spec.ts');
    expect(all.stdout).toContain('us9  test/acceptance/us9.acceptance.spec.ts');
    expect(all.stdout).toContain('No row of docs/architecture/slices.md belongs to us9');
  });

  it('refuses a story it knows nothing of, an unknown gate, and a lock without a story', () => {
    expect(cli(root, 'acceptance', 'US42').stderr).toContain(
      'US42 is neither a story of docs/architecture/slices.md nor the name of a spec of test/acceptance/.',
    );

    expect(cli(root, 'acceptance', 'US5', '--gate', 'green').stderr).toContain('Unknown gate "green".');
    expect(cli(root, 'acceptance', '--lock').stderr).toContain('--lock locks the acceptance of one story.');
  });
});

describe('acceptance without an HTTP stack', () => {
  it('refuses to generate a spec that has no API to drive', () => {
    const root = initProject('--http', 'none', '--context', 'ordering:core');

    write(root, 'docs/architecture/slices.md', SLICES);

    expect(cli(root, 'generate', 'acceptance', 'US5').stderr).toContain('The project has no HTTP stack');
  });
});
