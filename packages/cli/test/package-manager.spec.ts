import { describe, expect, it } from 'vitest';
import { inDialect } from '../src/package-manager/in-dialect';
import { cli, exists, read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

const MANAGERS = ['npm', 'pnpm'] as const;

describe('inDialect(), a text written for npm as another package manager says it', () => {
  it.each([
    ['npm run verify', 'pnpm run verify'],
    ['npm run build && knex migrate:latest', 'pnpm run build && knex migrate:latest'],
    // pnpm hands `--` over to the script: what follows the script name is already its arguments.
    ['npm run ci:lint -- --format gitlab', 'pnpm run ci:lint --format gitlab'],
    ['npm run --silent ci:arch:check -- --format gitlab', 'pnpm --silent run ci:arch:check --format gitlab'],
    ['npm test -- billing', 'pnpm test billing'],
    ['npm test', 'pnpm test'],
    ['`npm start`', '`pnpm start`'],
    ['npx --no -- eslint --no-warn-ignored {staged_files}', 'pnpm exec eslint --no-warn-ignored {staged_files}'],
    ['npx ddd-ts-kit check --changed-since main', 'pnpm exec ddd-ts-kit check --changed-since main'],
    ['RUN npm ci --omit=dev', 'RUN pnpm install --frozen-lockfile --prod'],
    ['test -d node_modules || npm ci', 'test -d node_modules || pnpm install --frozen-lockfile'],
    ['npm audit --omit=dev --audit-level=high', 'pnpm audit --prod --audit-level high'],
    ['npm install', 'pnpm install'],
    ['Bash(npm publish *)', 'Bash(pnpm publish *)'],
    ['COPY package.json package-lock.json ./', 'COPY package.json pnpm-lock.yaml ./'],
  ])('%s', (npm, pnpm) => {
    expect(inDialect(npm, 'npm')).toBe(npm);
    expect(inDialect(npm, 'pnpm')).toBe(pnpm);
  });

  it.each([
    '"@typescript/native": "npm:typescript@~7.0.2"',
    '- package-ecosystem: npm',
    'https://www.npmjs.com/package/ddd-ts-kit',
    'each behind one npm script',
    'pnpm run verify',
    'pnpm exec eslint',
  ])('leaves alone what is not a command of npm: %s', (text) => {
    expect(inDialect(text, 'pnpm')).toBe(text);
  });

  it.each(MANAGERS)('says the same thing when it translates twice (%s)', (manager) => {
    const text = 'npm ci && npm run build -- --flag && npx --no -- eslint . && npm run --silent x -- y';
    const once = inDialect(text, manager);

    expect(inDialect(once, manager)).toBe(once);
  });
});

describe('init --package-manager', () => {
  it('chooses pnpm when the flag is left out, and records the choice under stack', () => {
    const root = initProject();

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack')).toMatchObject({ packageManager: 'pnpm' });
    expect(readJson(root, 'package.json')).toMatchObject({ packageManager: 'pnpm@12.11.2' });
  });

  it('reads a config file that names no package manager as npm: it was written before the choice existed', () => {
    const root = initProject('--package-manager', 'npm');
    const config = read(root, 'ddd-ts-kit.config.json');

    expect(config).toContain('"packageManager": "npm"');
    expect(cli(root, 'list', '--json').code).toBe(0);
  });

  it.each(['yarn', 'bun'])('refuses %s, which no real install proved, with the ones it offers', (manager) => {
    const refused = cli(initProject(), 'init', '--force', '--package-manager', manager);

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain(`Unknown value "${manager}" for --package-manager.`);
    expect(refused.stderr).toContain('Use one of: npm, pnpm.');
  });

  it.each([
    ['npm', 'npm run', 'npx --no --', 'npm ci', 'package-lock.json'],
    ['pnpm', 'pnpm run', 'pnpm exec', 'pnpm install --frozen-lockfile', 'pnpm-lock.yaml'],
  ])(
    'writes every command in the dialect of %s: scripts, pipelines, hooks, Dockerfile, guidance, agent permissions',
    (manager, run, exec, install, lockfile) => {
      const root = initProject('--package-manager', manager, '--ci', 'both', '--context', 'billing:core');
      const scripts = textsAt(readJson(root, 'package.json'), 'scripts');

      const everything = [
        '.github/workflows/ci.yml',
        '.github/workflows/pr-title.yml',
        '.github/actions/setup/action.yml',
        '.gitlab-ci.yml',
        'lefthook.yml',
        'Dockerfile',
        'README.md',
        'AGENTS.md',
        '.claude/settings.json',
        '.claude/rules/tests.md',
        'docs/context-map.md',
      ].map((file) => read(root, file));

      expect(scripts['verify']).toContain(`${run} typecheck && ${run} lint`);
      expect(scripts['ci:typecheck']).toBe(`${run} typecheck`);
      expect(read(root, '.github/workflows/ci.yml')).toContain(`run: ${run} ci:typecheck`);
      expect(read(root, '.github/actions/setup/action.yml')).toContain(`run: ${install}`);
      expect(read(root, '.github/actions/setup/action.yml')).toContain(`hashFiles('${lockfile}', 'package.json')`);
      expect(read(root, '.gitlab-ci.yml')).toContain(`test -d node_modules || ${install}`);
      expect(read(root, '.gitlab-ci.yml')).toContain(`        - ${lockfile}\n        - package.json`);
      expect(read(root, 'lefthook.yml')).toContain(`run: ${exec} eslint --no-warn-ignored {staged_files}`);
      expect(read(root, 'Dockerfile')).toContain(`COPY package.json ${lockfile}`);
      expect(read(root, 'AGENTS.md')).toContain(`\`${run} verify\``);
      expect(read(root, '.claude/settings.json')).toContain(`Bash(${run} verify)`);

      for (const text of manager === 'npm' ? [] : everything) {
        expect(text).not.toMatch(/(?<![\w@/.-])(npm (run|ci|test|install|start)|npx)\b/);
        expect(text).not.toContain('package-lock.json');
      }
    },
  );

  it('gives pnpm the release corepack provides, in package.json, in the pipelines and in the image; npm comes with Node', () => {
    const npm = initProject('--package-manager', 'npm', '--ci', 'both');
    const pnpm = initProject('--package-manager', 'pnpm', '--ci', 'both');

    expect(readJson(npm, 'package.json')).not.toHaveProperty('packageManager');

    for (const file of ['.github/actions/setup/action.yml', '.gitlab-ci.yml', 'Dockerfile']) {
      expect(read(npm, file), file).not.toContain('corepack');
      expect(read(pnpm, file), file).toContain('corepack enable');
    }
  });

  it('tells pnpm that no dependency runs a build script unless allowed by name, as under npm: without it pnpm refuses to install', () => {
    const pnpm = initProject('--package-manager', 'pnpm');

    expect(read(pnpm, 'pnpm-workspace.yaml')).toMatch(/^strictDepBuilds: false$/m);
    expect(read(pnpm, 'Dockerfile')).toContain('COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./');
    expect(exists(initProject('--package-manager', 'npm'), 'pnpm-workspace.yaml')).toBe(false);
  });

  it('keeps what a generator writes later in the same dialect: a regenerated document does not drift', () => {
    const root = initProject('--package-manager', 'pnpm', '--context', 'billing:core');

    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);
    expect(read(root, 'docs/context-map.md')).toContain('`pnpm exec ddd-ts-kit docs`');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });
});
