import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { HANDLER_SPEC, slicedProject, WRITTEN_TITLE, commit } from './support/sliced-project';

const BILLING = 'src/contexts/billing';

/** The sections of the digest, in the order a reviewer reads them. */
const SECTIONS = [
  '**By context**',
  '**New spec titles**',
  '**To review, in reading order**',
  '**Regenerated, do not review**',
];

/** The files the slice changes and a person reviews, in reading order. */
const HAND_WRITTEN = [
  `${BILLING}/CONTEXT.md`,
  `${BILLING}/billing.permissions.ts`,
  `${BILLING}/domain/repositories/invoice.repository.ts`,
  `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`,
  `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`,
  `${BILLING}/presentation/http/invoices.routes.ts`,
  `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`,
  `${BILLING}/infrastructure/persistence/billing.schema.ts`,
  `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`,
  `${BILLING}/infrastructure/persistence/invoice.mapper.ts`,
  `${BILLING}/test/fakes/invoice.repository.fake.ts`,
  `${BILLING}/test/integration/invoice.repository.contract.spec.ts`,
  `${BILLING}/test/unit/issue-invoice.controller.spec.ts`,
  HANDLER_SPEC,
  'src/platform/auth/authorization/role.ts',
  'src/platform/auth/roles/roles.ts',
];

const REGENERATED = [
  'docs/behaviour/README.md',
  'docs/behaviour/billing.md',
  `${BILLING}/application/application.declarations.ts`,
  `${BILLING}/billing.declarations.ts`,
  `${BILLING}/infrastructure/infrastructure.declarations.ts`,
  `${BILLING}/presentation/presentation.declarations.ts`,
  'src/platform/database/schema.ts',
];

describe('digest --base, on a branch that builds one slice', () => {
  let root: string;
  let digest: string;

  beforeAll(() => {
    root = slicedProject();
    digest = cli(root, 'digest', '--base', 'main').stdout;
  });

  it('names the use case, its permission with the role that holds it, its route with its error codes and its port', () => {
    expect(digest).toContain('  - use case added: command `IssueInvoice` (`invoice.issue`)');
    expect(digest).toContain('  - permission added: `invoice.issue`, granted to `Role.Accountant`');

    expect(digest).toContain(
      '  - route added: `POST /invoices` -> `IssueInvoice` (`invoice.issue`), errors `UNAUTHORIZED`, `FORBIDDEN`',
    );

    expect(digest).toContain('  - port added: `InvoiceRepository` [repository], by `DrizzleInvoiceRepository`');
  });

  it('lists the spec titles the branch writes, and counts those the kit generated', () => {
    expect(digest).toContain(`- \`${HANDLER_SPEC}\`: ${WRITTEN_TITLE}`);
    expect(digest).toMatch(/^- and \d+ titles as the kit generated them$/m);
    expect(digest).not.toContain('is refused to an actor who does not hold the permission');
  });

  it('names every hand-written file in reading order, and the generated files apart, as regenerated', () => {
    const [, review = '', regenerated = ''] = digest.split(
      /^\*\*(?:To review, in reading order|Regenerated, do not review)\*\*$/m,
    );

    const named = (text: string): string[] => [...text.matchAll(/`([^`]+\.[a-z]+)`/g)].map((match) => match[1] ?? '');

    const changed = git(root, 'diff', '--name-only', 'main', 'HEAD')
      .split('\n')
      .filter((file) => file !== '');

    expect(named(review)).toEqual(HAND_WRITTEN);
    expect(named(regenerated)).toEqual(REGENERATED);
    expect([...HAND_WRITTEN, ...REGENERATED].sort()).toEqual([...changed].sort());

    expect(
      review
        .trim()
        .split('\n')
        .map((line) => line.split(':')[0]),
    ).toEqual([
      '- Context',
      '- Domain',
      '- Application',
      '- Presentation',
      '- Infrastructure',
      '- Tests',
      '- Elsewhere',
    ]);
  });

  it('holds its sections in reading order, in about thirty lines', () => {
    const lines = digest.split('\n');

    const fork = git(root, 'merge-base', 'main', 'HEAD').slice(0, 7);

    expect(lines.filter((line) => line.startsWith('**'))).toEqual(SECTIONS);
    expect(lines.filter((line) => line.startsWith('#'))).toEqual([]);

    expect(lines[0]).toBe(
      `Digest of \`slice/issue-invoice\` against \`main\` (\`${fork}\`): 23 files changed, 16 to review, 7 regenerated.`,
    );

    expect(lines.slice(4, 9)).toEqual([
      '- `billing`',
      '  - use case added: command `IssueInvoice` (`invoice.issue`)',
      '  - permission added: `invoice.issue`, granted to `Role.Accountant`',
      '  - route added: `POST /invoices` -> `IssueInvoice` (`invoice.issue`), errors `UNAUTHORIZED`, `FORBIDDEN`',
      '  - port added: `InvoiceRepository` [repository], by `DrizzleInvoiceRepository`',
    ]);

    expect(lines.length).toBeLessThanOrEqual(30);
  });

  it('reads both sides from git, and leaves the working tree, the branch and the temporary directory as they were', () => {
    expect(fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith('ddd-ts-kit-digest-'))).toEqual([]);
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(git(root, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('slice/issue-invoice');
  });
});

describe('digest --base --json', () => {
  let root: string;

  beforeAll(() => {
    root = slicedProject();
  });

  it('gives the same digest as data under --json, on one line', () => {
    const json = cli(root, 'digest', '--base', 'main', '--json');

    expect(json.stdout.split('\n')).toHaveLength(1);

    expect(json.json()).toEqual({
      base: 'main',
      baseCommit: git(root, 'merge-base', 'main', 'HEAD').trim(),
      head: git(root, 'rev-parse', 'HEAD').trim(),
      branch: 'slice/issue-invoice',
      contexts: [
        {
          name: 'billing',
          change: 'changed',
          useCases: [{ kind: 'command', name: 'IssueInvoice', permission: 'invoice.issue', change: 'added' }],
          permissions: [{ name: 'invoice.issue', grants: ['Role.Accountant'], change: 'added' }],
          routes: [
            {
              method: 'POST',
              path: '/invoices',
              useCase: 'IssueInvoice',
              permission: 'invoice.issue',
              errors: ['UNAUTHORIZED', 'FORBIDDEN'],
              change: 'added',
            },
          ],
          publishedEvents: [],
          consumedEvents: [],
          ports: [
            { name: 'InvoiceRepository', kind: 'repository', adapters: ['DrizzleInvoiceRepository'], change: 'added' },
          ],
        },
      ],
      specs: expect.arrayContaining([
        { file: HANDLER_SPEC, titles: [{ title: WRITTEN_TITLE, state: 'stated' }], generated: expect.any(Number) },
      ]),
      review: expect.arrayContaining([{ path: `${BILLING}/billing.permissions.ts`, part: 'context', change: 'added' }]),
      regenerated: REGENERATED,
      notes: [],
    });
  });
});

describe('digest --base, on the changes a branch makes after the slice', () => {
  let root: string;

  beforeAll(() => {
    root = slicedProject();
    git(root, 'checkout', '--quiet', '-b', 'slice/reference');
  });

  it('lists a CONTEXT.md changed in its generated sections alone as regenerated', () => {
    const doc = `${BILLING}/CONTEXT.md`;

    write(root, doc, readWithReference(root, doc));
    commit(root, 'docs(billing): the reference');

    const digest = cli(root, 'digest', '--base', 'slice/issue-invoice', '--json').json();

    expect(digest).toMatchObject({ contexts: [], review: [], regenerated: [doc] });
  });

  it('says in a note what is not committed, and digests the commits alone', () => {
    write(root, `${BILLING}/domain/invoice-number.ts`, 'export const INVOICE_NUMBER = 1;\n');

    expect(cli(root, 'digest', '--base', 'slice/issue-invoice', '--json').json()).toMatchObject({
      notes: ['1 file(s) changed and not committed are not in the digest: commit them, then run it again.'],
    });
  });
});

describe('digest --base, on a project below the top of its repository', () => {
  it('reads the project alone, its paths from the project root', () => {
    const root = slicedProject({ below: true });
    const digest = cli(root, 'digest', '--base', 'main');

    expect(digest.code).toBe(0);
    expect(digest.stdout).toContain('  - use case added: command `IssueInvoice` (`invoice.issue`)');
    expect(digest.stdout).toContain(`\`${HANDLER_SPEC}\``);
    expect(digest.stdout).not.toContain('apps/invoicing');
  });
});

describe('digest --base, on a repository that keeps its specs out of its archives', () => {
  it('still reads the spec titles, git archive and export-ignore aside', () => {
    const root = slicedProject({ attributes: '**/test/** export-ignore\n' });
    const digest = cli(root, 'digest', '--base', 'main');

    expect(digest.code).toBe(0);
    expect(digest.stdout).toContain(`- \`${HANDLER_SPEC}\`: ${WRITTEN_TITLE}`);
  });
});

describe('digest --base, on a branch that adds a context and its events', () => {
  let root: string;
  let digest: string;

  beforeAll(() => {
    root = slicedProject();
    git(root, 'checkout', '--quiet', '-b', 'slice/shipping');

    expectOk(cli(root, 'generate', 'integration-event', 'billing', 'Invoice', 'Issued'));

    expectOk(
      cli(
        root,
        'generate',
        'context',
        'shipping',
        '--classification',
        'supporting',
        '--upstream',
        'billing',
        '--term',
        'Parcel=A package handed to a carrier',
      ),
    );

    expectOk(cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued'));

    // The roles written otherwise than as an object literal: nobody is read as holding a permission by name.
    write(
      root,
      'src/platform/auth/roles/roles.ts',
      read(root, 'src/platform/auth/roles/roles.ts').replace(/= \{([\s\S]*)\};\n$/, '= Object.freeze({$1});\n'),
    );

    write(root, 'src/shared-kernel/money.ts', 'export type Money = { readonly cents: number };\n');
    write(root, 'test/acceptance/shipping.acceptance.spec.ts', "it.todo('#US2.01 ships a parcel');\n");
    commit(root, 'feat(shipping): react to an issued invoice');
    digest = cli(root, 'digest', '--base', 'main').stdout;
  });

  it('names the context added with the event it consumes, and the event the other publishes, with its versions', () => {
    expect(digest).toContain('- `shipping` (context added)');
    expect(digest).toContain('  - consumed event added: `billing.invoice.issued` from billing, by `');
    expect(digest).toContain('  - published event added: `billing.invoice.issued` v1');
    expect(digest).toContain('granted to no role by name');
  });

  it('reads the shared kernel with the domain and an acceptance spec with the tests', () => {
    expect(digest).toMatch(/^- Domain: .*`src\/shared-kernel\/money\.ts`/m);
    expect(digest).toMatch(/^- Tests: .*`test\/acceptance\/shipping\.acceptance\.spec\.ts`/m);
  });

  it('digests nothing against its own HEAD', () => {
    const same = cli(root, 'digest', '--base', 'HEAD').stdout;

    expect(same).toContain('No use case, permission, route, event or port changed.');
    expect(same).toContain('No file to review.');
    expect(same).toContain('0 files changed');
  });
});

describe('digest --base, on a base that holds no project this version reads', () => {
  it('says so in a note when the base commit holds no config at this path, and when it holds one it cannot read', () => {
    const top = tempDir('digest-no-project');
    const root = path.join(top, 'apps', 'invoicing');

    git(top, 'init', '--quiet', '--initial-branch', 'main');
    write(top, 'README.md', '# The repository\n');
    commit(top, 'chore: the repository');

    const before = git(top, 'rev-parse', 'HEAD').trim();

    expectOk(cli(root, 'init', '--context', 'billing:core'));

    const config = read(root, 'ddd-ts-kit.config.json');

    write(root, 'ddd-ts-kit.config.json', '[]\n');
    commit(top, 'feat: the project, its config broken');

    const broken = git(top, 'rev-parse', 'HEAD').trim();

    write(root, 'ddd-ts-kit.config.json', config);
    commit(top, 'fix: the config');

    expect(cli(root, 'digest', '--base', before, '--json').json()).toMatchObject({
      notes: [
        `The contexts of the base are not described: ${before.slice(0, 7)} holds no ddd-ts-kit.config.json at this path.`,
      ],
    });

    expect(cli(root, 'digest', '--base', broken).stdout).toContain(
      '- The contexts of the base are not described: ddd-ts-kit.config.json must hold a JSON object.',
    );
  });
});

/** The CONTEXT.md with a line added inside its generated reference, as `docs` writes it. */
function readWithReference(root: string, doc: string): string {
  return git(root, 'show', `HEAD:./${doc}`).replace(
    '<!-- /ddd-ts-kit:reference -->',
    'A line the kit writes.\n<!-- /ddd-ts-kit:reference -->',
  );
}
