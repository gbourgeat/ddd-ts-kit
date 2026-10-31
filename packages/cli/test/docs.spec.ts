import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers';
import { report } from './reports';
import { initProject } from './support/init-project';

let root: string;

beforeAll(() => {
  root = tempDir('docs');
  scaffoldEverything(root);
});

describe('docs', () => {
  it('is already up to date after init and generate', () => {
    const result = cli(root, 'docs', '--check');

    expect(result.stdout).toBe('The generated documentation is up to date.');
    expect(result.code).toBe(0);
  });

  it('draws the context map: one styled node per context, one labelled arrow per relationship, then the table', () => {
    const map = read(root, 'docs/context-map.md');

    expect(map).toContain('```mermaid\nflowchart LR\n  billing["billing<br/><small>core</small>"]:::core');
    expect(map).toContain('  order_fulfilment["order-fulfilment<br/><small>generic</small>"]:::generic');
    expect(map).toContain('  billing -->|customer-supplier| shipping');
    expect(map).toContain('  classDef core ');
    expect(map).toContain('| Context | Classification | Purpose | Upstreams | Downstreams | Published events |');

    expect(map).toContain(
      '| `billing` | core | Bills customers for what they bought. |  | `shipping` | `billing.invoice.issued` |',
    );

    expect(map).toContain('| `shipping` | supporting |  | `billing` |  |  |');
  });

  it('creates the written sections once, as headings with hints', () => {
    const map = read(root, 'docs/context-map.md');

    for (const heading of [
      '## Reading guide',
      '## Why these boundaries',
      '## Relationship notes',
      '## Known tensions',
    ]) {
      expect(map).toContain(`${heading}\n\nTODO(domain): `);
    }

    const integration = read(root, 'docs/integration/README.md');

    for (const heading of [
      '## Delivery guarantees',
      '## Provider',
      '## Versioning policy',
      '## Flows',
      '## External integrations',
    ]) {
      expect(integration).toContain(heading);
    }
  });

  it('names the stale file and exits 1 with --check, then repairs it', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as {
      contexts: Record<string, { upstreams: unknown[] }>;
    };

    config.contexts['order-fulfilment']?.upstreams.push({ context: 'billing', relationship: 'conformist' });
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('stale  docs/context-map.md');
    expect(stale.stdout).toContain('stale  src/contexts/order-fulfilment/CONTEXT.md');

    expect(cli(root, 'docs', '--check', '--json').json()).toMatchObject({
      ok: false,
      stale: expect.arrayContaining(['src/contexts/billing/CONTEXT.md']),
    });

    expect(cli(root, 'docs').stdout).toContain('updated      docs/context-map.md');
    expect(read(root, 'docs/context-map.md')).toContain('  billing -->|conformist| order_fulfilment');
    expect(read(root, 'src/contexts/order-fulfilment/CONTEXT.md')).toContain('- Downstream of `billing` (conformist).');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });
});

describe('docs, around what people wrote and what is missing', () => {
  it('keeps what people wrote outside the markers, and never rewrites the integration README', () => {
    write(
      root,
      'docs/context-map.md',
      read(root, 'docs/context-map.md').replace(
        /## Reading guide\n\nTODO\(domain\):[^\n]*/,
        '## Reading guide\n\nBilling issues, shipping follows.',
      ),
    );

    write(root, 'docs/integration/README.md', '# Integration\n\nOurs.\n');

    write(
      root,
      'src/contexts/billing/CONTEXT.md',
      read(root, 'src/contexts/billing/CONTEXT.md').replace(
        '<!-- ddd-ts-kit:aggregates -->\n- `Invoice`',
        '<!-- ddd-ts-kit:aggregates -->',
      ),
    );

    const result = report(cli(root, 'docs', '--json'));

    expect(result.updated).toEqual(['src/contexts/billing/CONTEXT.md']);
    expect(result.created).toEqual([]);
    expect(read(root, 'docs/context-map.md')).toContain('Billing issues, shipping follows.');
    expect(read(root, 'docs/integration/README.md')).toBe('# Integration\n\nOurs.\n');

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->',
    );
  });

  it('says what to restore when the markers of the context map are gone', () => {
    write(root, 'docs/context-map.md', '# Context map\n');

    const result = cli(root, 'docs', '--json');

    expect(result.code).toBe(2);
    expect((result.json() as { error: { fix: string } }).error.fix).toContain('<!-- ddd-ts-kit:context-map -->');
  });

  it('writes the documentation of a project that has none yet', () => {
    const bare = tempDir('docs-bare');

    cli(bare, 'init', '--context', 'billing:core');
    write(bare, 'docs/context-map.md', read(bare, 'docs/context-map.md'));

    expect(exists(bare, 'docs/integration/README.md')).toBe(true);
    expect(read(bare, 'docs/context-map.md')).toContain('billing["billing<br/><small>core</small>"]:::core');
  });

  it('reads the purpose of a context past the comments of its section', () => {
    const project = initProject('--context', 'shipping:supporting');
    const doc = 'src/contexts/shipping/CONTEXT.md';

    write(
      project,
      doc,
      read(project, doc).replace(
        /## Purpose\n\n[^\n]*/,
        '## Purpose\n\n<!-- one sentence, reused in the map --> Hands parcels to carriers. <!-- unclosed',
      ),
    );

    expect(cli(project, 'docs').code).toBe(0);
    expect(read(project, 'docs/context-map.md')).toContain('| `shipping` | supporting | Hands parcels to carriers. |');
  });

  it('adds the reference at the end of a CONTEXT.md written without any generated list, and notes the lists it lacks', () => {
    const project = initProject('--context', 'shipping:supporting');
    const doc = 'src/contexts/shipping/CONTEXT.md';

    write(project, doc, '# Shipping\n\n## Notes\n\nWritten by the team.');

    const result = cli(project, 'docs', '--json').json() as { notes: string[] };

    expect(result.notes).toContainEqual(expect.stringContaining(`${doc} has no "ddd-ts-kit:aggregates" region`));
    expect(result.notes.join('\n')).not.toContain('ddd-ts-kit:personal-data');

    expect(read(project, doc)).toMatch(
      /^# Shipping\n\n## Notes\n\nWritten by the team\.\n\n## Reference\n\n<!-- ddd-ts-kit:reference -->\n/,
    );
  });
});
