import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

// One project for the whole file: the fix FIX-412, its regression specs written, locked, then changed.
let root: string;

const STORY = 'docs/architecture/stories/FIX-412.md';
const LOCK = 'test/acceptance/fix-412.acceptance.lock.json';
const AGGREGATE_SPEC = 'src/contexts/ordering/test/unit/order.aggregate.spec.ts';
const HANDLER_SPEC = 'test/unit/cancel-order.handler.spec.ts';

const STATEMENT = `# FIX-412 A cancelled order frees its slot

## Statement

A customer cancels an order after it was shipped, and the order is still marked cancelled.

## Regression

- ${AGGREGATE_SPEC}
- \`./${HANDLER_SPEC}\`
`;

const REFUSES = '#FIX-412 refuses to cancel an order already shipped';
const KEEPS = '#FIX-412 keeps a shipped order shipped when its cancellation is refused';

const AGGREGATE = `import { describe, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';

describe('Order', () => {
  it('${REFUSES}', () => {
    given(anOrder().shipped().build())
      .when((order) => order.cancel())
      .thenError('ORDER_ALREADY_SHIPPED', { orderId: 'order-1' });
  });
});
`;

const HANDLER = `import { it } from 'vitest';
import { pending } from '@ddd-ts-kit/testing/e2e';

it('${KEEPS}', pending(async () => {
  expect(await status('order-1')).toBe('shipped');
}));
`;

beforeAll(() => {
  root = initProject('--context', 'ordering:core');
  write(root, STORY, STATEMENT);
});

/** The fingerprint `acceptance` reads now for a regression test, by its title. */
function fingerprintOf(title: string): string {
  const [story] = jsonAt(cli(root, 'acceptance', 'FIX-412', '--json').json(), 'stories') as Array<
    Record<string, unknown>
  >;

  const specs = (story?.['regression'] ?? []) as Array<{ tests: Array<Record<string, string>> }>;

  return specs.flatMap((spec) => spec.tests).find((test) => test['title'] === title)?.['fingerprint'] ?? 'none';
}

describe('the regression specs of a fix', () => {
  it('holds the fix from the written gate while a listed spec is missing or holds no test, and refuses the lock', () => {
    const missing = cli(root, 'acceptance', 'FIX-412', '--gate', 'written');

    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain('FIX-412  fix, 2 regression specs');
    expect(missing.stdout).toContain(`  ${AGGREGATE_SPEC}: missing`);
    expect(missing.stdout).toContain(`  ${HANDLER_SPEC}  ${HANDLER_SPEC} is listed under \`## Regression\``);
    expect(missing.stdout).not.toContain('No row of docs/architecture/slices.md');

    write(root, AGGREGATE_SPEC, 'export {};\n');
    write(root, HANDLER_SPEC, `${HANDLER}\nit.skip('#FIX-412 put aside', async () => {});\n`);

    const empty = cli(root, 'acceptance', 'FIX-412', '--gate', 'written', '--json');

    expect(empty.code).toBe(1);

    expect(jsonAt(empty.json(), 'stories', '0', 'problems')).toEqual([
      expect.objectContaining({ kind: 'regression-empty', at: AGGREGATE_SPEC, from: 'written' }),
      expect.objectContaining({ kind: 'pending', at: `${HANDLER_SPEC}:4`, from: 'passing' }),
      expect.objectContaining({ kind: 'skipped', at: `${HANDLER_SPEC}:8` }),
      expect.objectContaining({ kind: 'unlocked', at: LOCK, from: 'written' }),
    ]);

    expect(cli(root, 'acceptance', 'FIX-412').stdout).toContain(`  ${AGGREGATE_SPEC}: no test`);

    const refused = cli(root, 'acceptance', 'FIX-412', '--lock');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('The regression of FIX-412 is not written yet:');
    expect(refused.stderr).toContain(`${AGGREGATE_SPEC}  ${AGGREGATE_SPEC} holds no test`);
    expect(exists(root, LOCK)).toBe(false);
  });

  it('locks the tests of each listed spec once written, and meets the written gate', () => {
    write(root, AGGREGATE_SPEC, `${AGGREGATE}\nit.todo('#FIX-412 frees the slot');\n`);
    write(root, HANDLER_SPEC, HANDLER);

    const todo = cli(root, 'acceptance', 'FIX-412', '--gate', 'written');

    expect(todo.code).toBe(1);

    expect(todo.stdout).toContain(
      `${AGGREGATE_SPEC}:12  "#FIX-412 frees the slot" is still an it.todo: write the test.`,
    );

    write(root, AGGREGATE_SPEC, AGGREGATE);

    const locked = cli(root, 'acceptance', 'FIX-412', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).toBe(`Locked 2 regression tests of FIX-412 in ${LOCK}: commit it with them.`);

    expect(JSON.parse(read(root, LOCK))).toEqual({
      story: 'FIX-412',
      criteria: {},
      scenarios: [],
      regression: [
        { file: AGGREGATE_SPEC, title: REFUSES, fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/) },
        { file: HANDLER_SPEC, title: KEEPS, fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/) },
      ],
      amendments: [],
    });

    const written = cli(root, 'acceptance', 'FIX-412', '--gate', 'written');

    expect(written.code).toBe(0);
    expect(written.stdout).toContain('FIX-412  fix, 2 regression specs, locked');
    expect(written.stdout).toContain(`  ${AGGREGATE_SPEC}: 1 test, 1 active`);
    expect(written.stdout).toContain(`  ${HANDLER_SPEC}: 1 test, 1 pending`);
    expect(written.stdout).toContain('gate written: met');
    expect(cli(root, 'acceptance').stdout).toContain('FIX-412  fix');
  });

  it('holds the passing gate while a test is wrapped in pending(...), and keeps the lock once the wrapper goes', () => {
    const pending = cli(root, 'acceptance', 'FIX-412', '--gate', 'passing');

    expect(pending.code).toBe(1);
    expect(pending.stdout).toContain(`${HANDLER_SPEC}:4  "${KEEPS}" is wrapped in pending(...)`);

    write(root, HANDLER_SPEC, HANDLER.replace('pending(async () => {', 'async () => {').replace('}));', '});'));

    const passing = cli(root, 'acceptance', 'FIX-412', '--gate', 'passing');

    expect(passing.code).toBe(0);
    expect(passing.stdout).toContain('gate passing: met');
  });
});

describe('the regression specs of a fix, once locked', () => {
  it('reports a locked test changed, whatever the gate, until the judge lets that version through', () => {
    write(root, AGGREGATE_SPEC, AGGREGATE.replace("'ORDER_ALREADY_SHIPPED'", "'ORDER_CANCELLED'"));

    const drifted = cli(root, 'acceptance', 'FIX-412');

    expect(drifted.code).toBe(1);

    expect(drifted.stdout).toContain(
      `${LOCK}  The test "${REFUSES}" of ${AGGREGATE_SPEC} changed since the lock, and no verdict lets it through`,
    );

    const refused = cli(root, 'acceptance', 'FIX-412', '--lock');

    expect(refused.code).not.toBe(0);

    expect(refused.stderr).toContain(
      `Changed since the lock without a verdict that lets it through: test "${REFUSES}"`,
    );

    write(
      root,
      'test/acceptance/verdicts/fix-412-refuses.md',
      `# Verdict\n\nStory: FIX-412\nSubject: test "${REFUSES}" of ${AGGREGATE_SPEC}\nFingerprint: ${fingerprintOf(REFUSES)}\nVerdict: amend\nReason: the statement says the order stays cancelled, which ORDER_CANCELLED names\n`,
    );

    expect(cli(root, 'acceptance', 'FIX-412').code).toBe(0);

    const locked = cli(root, 'acceptance', 'FIX-412', '--lock');

    expect(locked.code).toBe(0);

    expect(locked.stdout).toContain(
      `Amended by test/acceptance/verdicts/fix-412-refuses.md, for the owner to validate`,
    );

    expect(JSON.parse(read(root, LOCK))).toMatchObject({
      amendments: [{ subject: `test "${REFUSES}" of ${AGGREGATE_SPEC}`, criteria: [] }],
    });
  });

  it('asks to lock again when a spec gains a test, and reports a locked test removed', () => {
    write(root, HANDLER_SPEC, `${read(root, HANDLER_SPEC)}\nit('#FIX-412 announces nothing', async () => {});\n`);

    const grown = cli(root, 'acceptance', 'FIX-412', '--gate', 'written');

    expect(grown.code).toBe(1);

    expect(grown.stdout).toContain(
      `Lock again (\`npx ddd-ts-kit acceptance FIX-412 --lock\`): "#FIX-412 announces nothing" of ${HANDLER_SPEC} is new.`,
    );

    expect(cli(root, 'acceptance', 'FIX-412').code).toBe(0);

    write(root, HANDLER_SPEC, "import { it } from 'vitest';\n\nit('#FIX-412 announces nothing', async () => {});\n");

    expect(cli(root, 'acceptance', 'FIX-412').stdout).toContain(
      `The test "${KEEPS}" of ${HANDLER_SPEC} changed since the lock, and no verdict lets it through: restore it as locked (git); or, when it truly failed its criterion or the statement changed, have the acceptance-judge agent judge "test "${KEEPS}" of ${HANDLER_SPEC}" at fingerprint removed.`,
    );
  });

  it('refuses to lock a fix whose section lists no spec', () => {
    write(root, 'docs/architecture/stories/FIX-7.md', '# FIX-7\n\n## Statement\n\nNothing.\n\n## Regression\n');

    const refused = cli(root, 'acceptance', 'FIX-7', '--lock');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('`## Regression` lists no spec file.');
    expect(cli(root, 'acceptance', 'FIX-7').stdout).toContain('FIX-7  fix, 0 regression specs');
  });
});
