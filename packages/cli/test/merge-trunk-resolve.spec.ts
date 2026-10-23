import { describe, expect, it } from 'vitest';
import type { ConflictedPath } from '../src/merge/conflicted-path.js';
import type { MergeRepository } from '../src/merge/lost/merge-repository.js';
import { mergeSlicesRows } from '../src/merge/merge-slices-rows.js';
import { mergeStoredEventsLock } from '../src/merge/merge-stored-events-lock.js';
import { resolveConflict } from '../src/merge/resolve-conflict.js';

const REPO: MergeRepository = { top: '/repository', prefix: '', contextsDir: 'src/contexts', modules: {} };

/** A conflict as diff3 markers write it, between settled lines. */
function conflict(ours: readonly string[], base: readonly string[], theirs: readonly string[]): string[] {
  return ['<<<<<<< HEAD', ...ours, '||||||| base', ...base, '=======', ...theirs, '>>>>>>> main'];
}

function path(file: string, merged: readonly string[], sides: Partial<ConflictedPath> = {}): ConflictedPath {
  return { file, binary: false, base: '', ours: 'ours', theirs: 'theirs', merged: merged.join('\n'), ...sides };
}

const slices = (...rows: readonly string[]): string =>
  [
    '# Slices',
    '',
    '| # | context | kind | slice | start with | depends on | owner | status |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');

const row = (id: string, slice: string, status: string, owner = 'billing'): string =>
  `| ${id} | billing | slice | ${slice} | generate command | | ${owner} | ${status} |`;

/** The package.json of a client as `sdk` writes it, at a version, with a description of its own. */
const clientManifest = (version: string, description = 'Typed client of Billing.'): string =>
  `${JSON.stringify({ name: '@shop/billing-client', version, description, type: 'module' }, null, 2)}\n`;

const MANIFEST = 'clients/billing/package.json';

describe('merge-trunk: the package.json of a client', () => {
  it('keeps the trunk side at the version this branch raised above it', () => {
    const settled = resolveConflict(
      path(MANIFEST, conflict(['  "version": "1.3.0",'], ['  "version": "1.2.0",'], ['  "version": "1.2.1",']), {
        base: clientManifest('1.2.0'),
        ours: clientManifest('1.3.0'),
        theirs: clientManifest('1.2.1', 'Typed client of Billing, with refunds.'),
      }),
      REPO,
    );

    expect(settled).toMatchObject({
      kind: 'client-manifest',
      settled: true,
      content: clientManifest('1.3.0', 'Typed client of Billing, with refunds.'),
      how: 'client package.json: trunk side, version 1.3.0 kept, the higher of 1.3.0 on this branch and 1.2.1 on the trunk',
    });
  });

  it('keeps the trunk side as it is when its version is the higher', () => {
    const theirs = clientManifest('2.0.0-rc.1', 'Typed client of Billing, with refunds.');

    expect(resolveConflict(path(MANIFEST, [], { ours: clientManifest('1.9.0'), theirs }), REPO)).toMatchObject({
      kind: 'client-manifest',
      settled: true,
      content: theirs,
    });
  });

  it('leaves the choice to a person when a version is not a semantic version', () => {
    const left = resolveConflict(
      path(MANIFEST, conflict(['  "version": "next",'], [], ['  "version": "1.2.1",']), {
        ours: clientManifest('next'),
        theirs: clientManifest('1.2.1'),
      }),
      REPO,
    );

    expect(left).toMatchObject({
      kind: 'source',
      settled: false,
      how: 'the version of a side is not a semantic version (next on this branch, 1.2.1 on the trunk)',
    });

    expect(left.blocks).toHaveLength(1);
  });

  it('takes the deletion of the trunk, and leaves the other files of a client derived', () => {
    const { theirs, ...deleted } = path(MANIFEST, [], { ours: clientManifest('1.3.0') });

    expect(theirs).toBe('theirs');
    expect(resolveConflict(deleted, REPO)).toMatchObject({ kind: 'client-manifest', settled: true, content: null });

    for (const file of ['clients/billing/src/package.json', 'clients/package.json', 'package.json']) {
      expect(resolveConflict(path(file, [], { ours: '{}', theirs: '{}' }), REPO).kind).not.toBe('client-manifest');
    }
  });
});

describe('merge-trunk: what is settled without a person', () => {
  it('takes the trunk side of a derived file, a drizzle-kit journal and a lockfile, and deletes one the trunk deleted', () => {
    for (const [file, kind] of [
      ['openapi/openapi.yaml', 'derived'],
      ['src/contexts/billing/billing.declarations.ts', 'derived'],
      ['src/contexts/billing/application/commands/commands.declarations.ts', 'derived'],
      ['src/contexts/billing/infrastructure/infrastructure.declarations.ts', 'derived'],
      ['migrations/meta/_journal.json', 'drizzle-meta'],
      ['migrations/meta/20261015101500_snapshot.json', 'drizzle-meta'],
      ['package-lock.json', 'lockfile'],
    ] as const) {
      expect(resolveConflict(path(file, conflict(['a'], [], ['b'])), REPO)).toMatchObject({
        kind,
        settled: true,
        content: 'theirs',
      });
    }

    const { theirs, ...deleted } = path('clients/billing.ts', conflict(['a'], [], ['b']));

    expect(theirs).toBe('theirs');
    expect(resolveConflict(deleted, REPO)).toMatchObject({ kind: 'derived', settled: true, content: null });
  });

  it('takes the trunk side inside the generated regions of CONTEXT.md, and leaves a conflict outside them to a person', () => {
    const regions = [
      '# billing',
      '<!-- ddd-ts-kit:events -->',
      ...conflict(['- Invoice paid'], [], ['- Invoice cancelled']),
      '<!-- /ddd-ts-kit:events -->',
      '',
    ];

    const settled = resolveConflict(path('src/contexts/billing/CONTEXT.md', regions), REPO);

    expect(settled).toMatchObject({ kind: 'mixed', settled: true });

    expect(settled.content).toBe(
      ['# billing', '<!-- ddd-ts-kit:events -->', '- Invoice cancelled', '<!-- /ddd-ts-kit:events -->', ''].join('\n'),
    );

    const glossary = [
      ...regions.slice(0, -1),
      '',
      '| Term | Meaning |',
      ...conflict(['| Payment | money received |'], [], ['| Refund | money returned |']),
      '',
    ];

    const left = resolveConflict(path('docs/context-map.md', glossary), REPO);

    expect(left).toMatchObject({ kind: 'mixed', settled: false, how: 'a conflict outside any generated region' });
    expect(left.blocks).toHaveLength(1);
    expect(left.content).toContain('- Invoice cancelled');
    expect(left.content).toContain('<<<<<<< HEAD\n| Payment | money received |');
  });

  it('merges a generated registry as sets: both additions kept, a removal by one side honoured, imports joined by module', () => {
    const routes = [
      'export const routes = [',
      '  // ddd-ts-kit:routes',
      ...conflict(
        ['  issueInvoiceRoute,', '  payInvoiceRoute,'],
        ['  issueInvoiceRoute,', '  legacyRoute,'],
        ['  issueInvoiceRoute,', '  legacyRoute,', '  cancelInvoiceRoute,'],
      ),
      '  // /ddd-ts-kit:routes',
      '];',
      '',
    ];

    const merged = resolveConflict(path('src/platform/http/routes.ts', routes), REPO);

    expect(merged).toMatchObject({ kind: 'registry', settled: true });

    expect(merged.content).toBe(
      [
        'export const routes = [',
        '  // ddd-ts-kit:routes',
        '  issueInvoiceRoute,',
        '  payInvoiceRoute,',
        '  cancelInvoiceRoute,',
        '  // /ddd-ts-kit:routes',
        '];',
        '',
      ].join('\n'),
    );

    const imports = [
      '// ddd-ts-kit:imports',
      ...conflict(
        ["import { Invoice } from './invoice';", "import { Clock } from './clock';"],
        ["import { Invoice } from './invoice';"],
        ["import { Invoice, Payment } from './invoice';"],
      ),
      '// /ddd-ts-kit:imports',
    ];

    expect(resolveConflict(path('src/platform/wiring.ts', imports), REPO).content).toBe(
      [
        '// ddd-ts-kit:imports',
        "import { Clock } from './clock';",
        "import { Invoice, Payment } from './invoice';",
        '// /ddd-ts-kit:imports',
      ].join('\n'),
    );
  });
});

describe('merge-trunk: what is left to a person, and what merges by key', () => {
  it('leaves to a person a source conflict outside regions, a file one side deleted, and bytes that are not text', () => {
    const source = resolveConflict(
      path('src/contexts/billing/invoice.ts', [
        'class Invoice {',
        ...conflict(['  pay() {}'], [], ['  cancel() {}']),
        '}',
      ]),
      REPO,
    );

    expect(source).toMatchObject({
      kind: 'source',
      settled: false,
      content: undefined,
      blocks: [{ line: 2, ours: ['  pay() {}'], theirs: ['  cancel() {}'] }],
    });

    const { ours, ...deletedHere } = path('src/contexts/billing/invoice.ts', []);

    expect(ours).toBe('ours');

    expect(resolveConflict(deletedHere, REPO)).toMatchObject({
      settled: false,
      how: 'this branch deleted it, the other side changed it',
    });

    expect(resolveConflict(path('docs/logo.png', [], { binary: true }), REPO)).toMatchObject({
      settled: false,
      how: 'a side is not text',
    });
  });

  it('merges the slices rows: the furthest status, each cell by the side that changed it, new rows placed after their neighbour', () => {
    const base = slices(
      row('US1.01', 'Issue invoice', 'done'),
      row('US1.02', 'Pay invoice', 'todo'),
      row('US1.03', 'Cancel invoice', 'todo'),
    );

    const ours = slices(
      row('US1.01', 'Issue invoice', 'done'),
      row('US1.02', 'Pay invoice', 'done'),
      row('US1.03', 'Cancel invoice', 'in progress'),
    );

    const theirs = slices(
      row('US1.01', 'Issue invoice', 'done'),
      row('US1.02', 'Pay an invoice', 'todo'),
      row('US1.03', 'Cancel invoice', 'done'),
      row('US1.04', 'Refund invoice', 'todo'),
    );

    expect(mergeSlicesRows(base, ours, theirs)).toEqual({
      text: slices(
        row('US1.01', 'Issue invoice', 'done'),
        row('US1.02', 'Pay an invoice', 'done'),
        row('US1.03', 'Cancel invoice', 'done'),
        row('US1.04', 'Refund invoice', 'todo'),
      ),
    });

    expect(resolveConflict(path('docs/architecture/slices.md', [], { base, ours, theirs }), REPO)).toMatchObject({
      kind: 'slices',
      settled: true,
    });
  });

  it('leaves the slices file to a person when both sides changed one cell differently', () => {
    const base = slices(row('US1.02', 'Pay invoice', 'todo'));
    const ours = slices(row('US1.02', 'Pay invoice', 'todo', 'billing-a'));
    const theirs = slices(row('US1.02', 'Pay invoice', 'todo', 'billing-b'));

    expect(mergeSlicesRows(base, ours, theirs)).toEqual({ conflicts: ['#US1.02 owner'] });

    expect(resolveConflict(path('docs/architecture/slices.md', [], { base, ours, theirs }), REPO)).toMatchObject({
      settled: false,
      how: 'both sides changed #US1.02 owner differently',
    });
  });

  it('merges the stored-events lock by key, and leaves a version recorded with two shapes to a person', () => {
    const ours = JSON.stringify({ 'billing.invoice.paid': { 1: 'sha256:aa' } });

    const theirs = JSON.stringify({
      'billing.invoice.cancelled': { 1: 'sha256:bb' },
      'billing.invoice.paid': { 1: 'sha256:aa' },
    });

    expect(mergeStoredEventsLock(ours, theirs)).toEqual({
      text: `${JSON.stringify({ 'billing.invoice.cancelled': { 1: 'sha256:bb' }, 'billing.invoice.paid': { 1: 'sha256:aa' } }, null, 2)}\n`,
    });

    expect(mergeStoredEventsLock(ours, JSON.stringify({ 'billing.invoice.paid': { 1: 'sha256:cc' } }))).toEqual({
      conflicts: ['billing.invoice.paid v1'],
    });

    expect(resolveConflict(path('stored-events.lock.json', [], { ours, theirs }), REPO)).toMatchObject({
      kind: 'stored-events',
      settled: true,
    });
  });
});
