import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir, walk, write } from './helpers';
import { toEarlierPlaces } from './support/to-earlier-places';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';
const ROOT_PATTERN = 'src/contexts/*/*.codes.ts';
const EARLIER_PATTERN = 'src/contexts/*/domain/errors/codes.ts';
const CODES = `${BILLING}/billing.codes.ts`;
const PERMISSIONS = `${BILLING}/billing.permissions.ts`;
const EARLIER_CODES = `${BILLING}/domain/errors/codes.ts`;
const EARLIER_PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;

let root: string;

beforeAll(() => {
  root = tempDir('context-layout');
  scaffoldEverything(root, undefined, ['--refusals', 'named']);
});

describe('the code list and the permission set of a context', () => {
  it('are written at the root of the context, and every import names them there', () => {
    expect(exists(root, CODES)).toBe(true);
    expect(exists(root, PERMISSIONS)).toBe(true);
    expect(exists(root, EARLIER_CODES)).toBe(false);
    expect(read(root, HANDLER)).toContain("from '@/contexts/billing/billing.permissions';");
    expect(cli(root, 'check').stdout).toContain('0 errors, 0 warnings');
  });
});

describe('a project that keeps them where 0.86 and 0.87 wrote them', () => {
  beforeAll(() => toEarlierLayout());

  it('is an error of tree/closed, which names the command that moves them', () => {
    const checked = cli(root, 'check', '--rule', 'tree/closed', '--json');

    expect(checked.code).toBe(1);

    expect(checked.json()).toMatchObject({
      errors: 2,
      violations: [
        { ruleId: 'tree/closed', severity: 'error', file: EARLIER_PERMISSIONS },
        { ruleId: 'tree/closed', severity: 'error', file: EARLIER_CODES },
      ],
    });

    expect(cli(root, 'check', '--rule', 'tree/closed').stdout).toContain('npx ddd-ts-kit context-layout');
  });

  it('is generated into where it is: a new permission joins the set of 0.86 and 0.87, and its import names it there', () => {
    const generated = cli(
      root,
      'generate',
      'command',
      'billing',
      'VoidInvoice',
      '--permission',
      'invoice.void',
      '--allow-name',
    );

    expect(generated.code).toBe(0);
    expect(exists(root, PERMISSIONS)).toBe(false);
    expect(read(root, EARLIER_PERMISSIONS)).toContain("'invoice.void'");

    expect(read(root, `${BILLING}/application/commands/void-invoice/void-invoice.command.ts`)).toContain(
      "from '@/contexts/billing/application/authorization/billing.permissions';",
    );
  });

  it('tells knip of a code list written at the root of another context, the earlier place still told of', () => {
    const generated = cli(
      root,
      'generate',
      'error',
      'shipping',
      'UnknownParcel',
      'forParcel',
      '--code',
      'PARCEL_NOT_FOUND',
      '--term',
      'Parcel=A package handed to a carrier',
    );

    expect(generated.code).toBe(0);
    expect(exists(root, `${SHIPPING}/shipping.codes.ts`)).toBe(true);
    expect(Object.keys(JSON.parse(read(root, 'knip.json')).ignoreIssues)).toEqual([ROOT_PATTERN, EARLIER_PATTERN]);
  });

  it('moves to the root on context-layout, with every import of them, and passes the checks', () => {
    const dryRun = cli(root, 'context-layout', '--dry-run');

    expect(dryRun.stdout).toContain(`would move    ${EARLIER_CODES} -> ${CODES}`);
    expect(exists(root, EARLIER_CODES)).toBe(true);

    const moved = cli(root, 'context-layout', '--json');

    expect(moved.code).toBe(0);

    expect(moved.json()).toMatchObject({
      moved: [
        { from: EARLIER_CODES, to: CODES },
        { from: EARLIER_PERMISSIONS, to: PERMISSIONS },
      ],
    });

    expect(exists(root, EARLIER_PERMISSIONS)).toBe(false);
    expect(read(root, HANDLER)).toContain("from '@/contexts/billing/billing.permissions';");
    expect(Object.keys(JSON.parse(read(root, 'knip.json')).ignoreIssues)).toEqual([ROOT_PATTERN]);
    expect(cli(root, 'check', '--rule', 'tree/closed', '--json').json()).toMatchObject({ errors: 0, warnings: 0 });

    const earlierImports = walk(root, BILLING).filter((file) =>
      /application\/authorization\/billing\.permissions'|domain\/errors\/codes'/.test(read(root, file)),
    );

    expect(earlierImports).toEqual([]);
    expect(cli(root, 'context-layout').stdout).toBe('Nothing to do: the files of every context are in their place.');
  });

  it('moves one context at a time, knip told of the earlier place while another context holds a list there', () => {
    write(root, `${SHIPPING}/domain/errors/codes.ts`, read(root, `${SHIPPING}/shipping.codes.ts`));
    fs.rmSync(path.join(root, SHIPPING, 'shipping.codes.ts'));
    expect(cli(root, 'context-layout', 'billing').code).toBe(0);
    expect(Object.keys(JSON.parse(read(root, 'knip.json')).ignoreIssues)).toEqual([ROOT_PATTERN, EARLIER_PATTERN]);

    const moved = cli(root, 'context-layout', 'shipping');

    expect(moved.stdout).toContain(`move          ${SHIPPING}/domain/errors/codes.ts -> ${SHIPPING}/shipping.codes.ts`);
    expect(moved.stdout).toContain('write         knip.json');
    expect(Object.keys(JSON.parse(read(root, 'knip.json')).ignoreIssues)).toEqual([ROOT_PATTERN]);
  });

  it('leaves a context that holds both places to a person, and tree/closed refuses it', () => {
    write(root, EARLIER_CODES, read(root, CODES));

    const said = cli(root, 'context-layout', '--json').json() as { manual: string[] };

    expect(said.manual[0]).toContain(`${EARLIER_CODES} and ${CODES} both exist: keep ${CODES}`);
    expect(cli(root, 'check', '--rule', 'tree/closed').code).toBe(1);
    expect(cli(root, 'context-layout', 'nowhere').code).not.toBe(0);
  });
});

/** The project of the spec as 0.86 and 0.87 laid it out: the files of billing in their role folders, knip told of them there. */
function toEarlierLayout(): void {
  toEarlierPlaces(root, ['billing']);

  const knip = JSON.parse(read(root, 'knip.json'));

  write(root, 'knip.json', `${JSON.stringify({ ...knip, ignoreIssues: { [EARLIER_PATTERN]: ['types'] } }, null, 2)}\n`);
}
