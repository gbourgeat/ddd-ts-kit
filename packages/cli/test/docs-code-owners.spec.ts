import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';

const CONFIG = 'ddd-ts-kit.config.json';

/** Two contexts, shipping downstream of billing; nobody owns anything yet. */
function project(): string {
  const root = initProject(...NPM, '--context', 'billing:core');

  cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting', '--upstream', 'billing');

  return root;
}

function configure(root: string, change: (config: Record<string, unknown>) => void): void {
  const config: Record<string, unknown> = JSON.parse(read(root, CONFIG));

  change(config);
  write(root, CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}

function own(root: string, owners: Record<string, string[]>, platform: string[] = []): void {
  configure(root, (config) => {
    const contexts = config['contexts'] as Record<string, Record<string, unknown>>;

    for (const [name, handles] of Object.entries(owners)) {
      contexts[name] = { ...contexts[name], owners: handles };
    }

    if (platform.length > 0) {
      config['owners'] = { platform };
    }
  });
}

describe('docs, the code owners', () => {
  it('writes nothing while no owner is configured', () => {
    const root = project();

    expect(cli(root, 'docs').code).toBe(0);
    expect(exists(root, 'CODEOWNERS')).toBe(false);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('writes the ownership table of the team workflow guide between its markers, once an owner is configured', () => {
    const root = project();

    own(root, { billing: ['@shop/billing-team'], shipping: ['@shop/logistics', '@lea'] }, ['@shop/tech-lead']);

    expect(cli(root, 'docs', '--check').code).toBe(1);
    expect(cli(root, 'docs', '--check').stdout).toContain('stale  CODEOWNERS');
    expect(cli(root, 'docs').code).toBe(0);

    const owners = read(root, 'CODEOWNERS');
    const lines = owners.split('\n').map((line) => line.replace(/\s+/g, ' ').trim());

    expect(lines[0]).toContain('from the owners of ddd-ts-kit.config.json');
    expect(lines).toContain('# ddd-ts-kit:code-owners');
    expect(lines).toContain('# /ddd-ts-kit:code-owners');
    expect(lines).toContain('src/contexts/billing/ @shop/billing-team');
    expect(lines).toContain('src/contexts/billing/published-language/ @shop/billing-team');

    expect(lines).toContain(
      '# The consumers of the published language of billing, to ask as reviewers: shipping (@shop/logistics @lea).',
    );

    expect(lines).toContain('src/contexts/shipping/ @shop/logistics @lea');
    expect(lines).toContain('src/contexts/shipping/published-language/ @shop/logistics @lea');
    // Nothing imports the shared kernel yet: the platform owners hold it until a context does.
    expect(lines).toContain('src/shared-kernel/ @shop/tech-lead');

    for (const file of [
      'src/platform/',
      'src/main.ts',
      'ddd-ts-kit.config.json',
      'lefthook.yml',
      'commitlint.config.mjs',
      '.github/workflows/',
      '.github/actions/',
      'REVIEW.md',
      'AGENTS.md',
      'docs/adr/',
    ]) {
      expect(lines).toContain(`${file} @shop/tech-lead`);
    }

    expect(lines.some((line) => line.startsWith('.gitlab'))).toBe(false);
    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');
  });

  it('gives the shared kernel to every context that imports it, and reports the file stale when an owner changes', () => {
    const root = project();

    own(root, { billing: ['@shop/billing-team'], shipping: ['@shop/logistics'] });
    cli(root, 'docs');

    expect(read(root, 'CODEOWNERS')).not.toContain('src/shared-kernel/');
    expect(read(root, 'CODEOWNERS')).not.toContain('src/platform/');

    write(root, 'src/contexts/shipping/domain/parcel.ts', "import { Money } from '@/shared-kernel/money';\n");

    const check = cli(root, 'docs', '--check');

    expect(check.code).toBe(1);
    expect(check.stdout).toContain('stale  CODEOWNERS');

    cli(root, 'docs');

    expect(read(root, 'CODEOWNERS').replace(/ +/g, ' ')).toContain('src/shared-kernel/ @shop/logistics\n');
  });

  it('appends its block after a file the team wrote, keeps it, and names the files of GitLab for that pipeline', () => {
    const root = initProject(...NPM, '--ci', 'gitlab', '--context', 'billing:core');

    write(root, 'CODEOWNERS', '# ours\ndocs/ @shop/writers\n');
    own(root, { billing: ['@shop/billing-team'] }, ['@shop/tech-lead']);
    cli(root, 'docs');

    const owners = read(root, 'CODEOWNERS');

    expect(owners.startsWith('# ours\ndocs/ @shop/writers\n\n# Code owners')).toBe(true);
    expect(owners.replace(/ +/g, ' ')).toContain('.gitlab-ci.yml @shop/tech-lead');
    expect(owners.replace(/ +/g, ' ')).toContain('.gitlab/ @shop/tech-lead');
    expect(owners).not.toContain('.github/');

    write(root, 'CODEOWNERS', owners.replace('@shop/billing-team', '@someone-else'));

    expect(cli(root, 'docs', '--check').code).toBe(1);

    cli(root, 'docs');

    expect(read(root, 'CODEOWNERS')).not.toContain('@someone-else');
    expect(read(root, 'CODEOWNERS').startsWith('# ours\ndocs/ @shop/writers\n')).toBe(true);
  });

  it('writes the owners of a context and of the platform only when there are some, and reads them back', () => {
    const written = serializeConfig(
      parseConfig({
        contexts: { billing: { classification: 'core', owners: ['@shop/billing-team'] }, shipping: {} },
        owners: { platform: ['@shop/tech-lead', 'lea@example.test'] },
      }),
    );

    expect(written).toContain('"owners": ["@shop/billing-team"]');
    expect(written).toContain('"platform": ["@shop/tech-lead", "lea@example.test"]');
    expect(written.match(/"owners"/g)).toHaveLength(2);

    expect(parseConfig(JSON.parse(written))).toMatchObject({
      contexts: { billing: { owners: ['@shop/billing-team'] }, shipping: { owners: [] } },
      owners: { platform: ['@shop/tech-lead', 'lea@example.test'] },
    });

    expect(serializeConfig(parseConfig({}))).not.toContain('owners');
  });

  it('keeps the owners through init --force', () => {
    const root = project();

    own(root, { billing: ['@shop/billing-team'] }, ['@shop/tech-lead']);
    cli(root, 'docs');
    cli(root, 'init', '--force');

    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(read(root, 'CODEOWNERS')).toContain('@shop/billing-team');
  });
});
