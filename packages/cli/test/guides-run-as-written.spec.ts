import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ERRORS_DOCS } from '../src/check/explain/errors-docs';
import { STANDARD_DOCS } from '../src/check/explain/standard-docs';
import { cli, exists, read, REPO_ROOT, tempDir, write } from './helpers';

const page = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

/** Splits a command line the way a shell does for double and single quotes, enough for the lines of the pages. */
function words(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

/** The `generate error` and `generate domain-event` lines a page cites in backticks, wherever the prose wraps them. */
function citedGenerateLines(file: string): string[] {
  const text = page(file).replace(/\n(?!\n)/g, ' ');

  return [...text.matchAll(/`(generate (?:error|domain-event) [^`]+)`/g)].map((match) => match[1] ?? '');
}

describe('guides, first-slice, on the project the README builds', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('guides-first-slice');
    expect(cli(root, 'init').code).toBe(0);

    const readme = page('README.md').replace(/ \\\n\s+/g, ' ');
    const start = readme.indexOf('pnpm exec ddd-ts-kit generate context ordering');

    const lines = readme
      .slice(start)
      .split('\n')
      .slice(0, 6)
      .map((line) => line.replace(/^(pnpm exec )?ddd-ts-kit /, ''));

    for (const line of lines) {
      const result = cli(root, ...words(line));

      expect(result.code, `${line} ${result.stderr}`).toBe(0);
    }
  });

  it('accepts every generate line the guide cites, after the lines of the README', () => {
    const cited = citedGenerateLines('docs/guides/first-slice.md');

    expect(cited).toHaveLength(2);

    for (const line of cited) {
      const result = cli(root, ...words(line));

      expect(result.code, `${line} ${result.stderr}`).toBe(0);
    }

    expect(read(root, 'src/contexts/ordering/domain/errors/order-empty.error.ts')).toContain('OrderEmpty');
  });

  it('cites the same lines on the French page', () => {
    expect(citedGenerateLines('docs/guides/first-slice.fr.md')).toEqual(
      citedGenerateLines('docs/guides/first-slice.md'),
    );
  });
});

describe('guides, closing-the-loop, the outbox query', () => {
  it('names the table in the schema the generated project puts it in', () => {
    const schema = read(path.join(REPO_ROOT, 'packages/cli/templates/init/platform/database'), 'schema.drizzle.ts.tpl');

    const name = /MESSAGING_SCHEMA = '(\w+)'/.exec(schema)?.[1];

    expect(name).toBe('messaging');

    for (const file of ['docs/guides/closing-the-loop.md', 'docs/guides/closing-the-loop.fr.md']) {
      expect(page(file), file).toContain(`FROM ${name}.outbox WHERE status = 'pending'`);

      expect(page(file), file).toMatch(/`<sch[eé]ma>\.outbox`/);
    }
  });
});

describe('guides, the examples of explain, in a project init wrote', () => {
  const TERMS = [
    '--term',
    'Slot=A time a calendar offers',
    '--term',
    'Availability=When a calendar takes appointments',
  ];

  const CODES = 'src/contexts/appointment/appointment.codes.ts';
  let root: string;

  beforeAll(() => {
    root = tempDir('guides-explain');
    expect(cli(root, 'init').code).toBe(0);

    expect(
      cli(
        root,
        'generate',
        'context',
        'appointment',
        '--classification',
        'core',
        ...TERMS,
        '--term',
        'Taken=Held already',
        '--term',
        'Outside=Beyond',
      ).code,
    ).toBe(0);

    expect(cli(root, 'generate', 'error', 'appointment', 'SlotTaken', 'forCalendar').code).toBe(0);
    expect(cli(root, 'generate', 'error', 'appointment', 'OutsideAvailability', 'forStart').code).toBe(0);
  });

  it('errors/code-unique: the Bad sample is reported, the Good sample is accepted', () => {
    const doc = ERRORS_DOCS['errors/code-unique'];

    write(root, CODES, `${doc?.bad}\n`.replace(/^\/\/ .*\n/, ''));

    expect(cli(root, 'check', '--rule', 'errors/code-unique').code).toBe(1);

    write(root, CODES, `${doc?.good}\n`.replace(/^\/\/ .*\n/, ''));

    expect(cli(root, 'check', '--rule', 'errors/code-unique').code).toBe(0);
  });

  it('governance/recorded-deviation: the Good sample is accepted without a warning', () => {
    const good = STANDARD_DOCS['governance/recorded-deviation']?.good ?? '';
    const lines = good.split('\n').filter((line) => line.startsWith('"'));
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as Record<string, unknown>;

    write(
      root,
      'ddd-ts-kit.config.json',
      JSON.stringify({ ...config, ...JSON.parse(`{${lines.join('\n').replace(/,$/, '')}}`) }),
    );

    write(
      root,
      'docs/adr/0009-no-spec-for-generated-adapters.md',
      '# 9. No spec for generated adapters\n\nStatus: accepted\n',
    );

    const result = cli(root, 'check', '--json');

    expect(JSON.stringify(result.json())).not.toMatch(/governance\/recorded-deviation|config\/rule-off-everywhere/);
  });
});

describe('guides, deploy-and-rollback, on the observability a generated project has', () => {
  const tree = tempDir('guides-deploy');

  it('promises no metric the platform does not emit, and names the file init writes', () => {
    expect(cli(tree, 'init').code).toBe(0);
    expect(read(tree, 'src/platform/observability/create-metrics.ts')).toContain('return new NoopMetrics();');
    expect(exists(tree, '.env.example')).toBe(true);
    expect(exists(tree, 'docker')).toBe(false);

    for (const file of ['docs/guides/deploy-and-rollback.md', 'docs/guides/deploy-and-rollback.fr.md']) {
      expect(page(file), file).not.toMatch(/docker\/\.env/);
      expect(page(file), file).toContain('create-metrics.ts');
      expect(page(file), file).toContain('store.stats()');
    }
  });
});

describe('guides, the README, on the command that reads the plan', () => {
  it('says status answers once init wrote the project, and the command refuses before it', () => {
    const empty = tempDir('guides-status');
    const refused = cli(empty, 'status');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('No ddd-ts-kit.config.json');

    expect(page('README.md').replace(/\s+/g, ' ')).toContain(
      'once `init` has written the project (step 5), `npx ddd-ts-kit status`',
    );

    expect(page('README.fr.md').replace(/\s+/g, ' ')).toContain(
      'une fois le projet écrit par `init` (étape 5), `npx ddd-ts-kit status`',
    );
  });
});
