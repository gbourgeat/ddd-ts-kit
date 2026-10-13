import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { NPM } from './support/npm.js';
import { parseFrontmatter } from './support/parse-frontmatter.js';

const RULE_FILES = [
  'domain',
  'application',
  'published-language',
  'infrastructure',
  'presentation',
  'platform',
  'tests',
];

const RULE_STACKS = [
  '',
  '--http nest',
  '--http none --orm none',
  '--di manual --orm knex --ci gitlab',
  '--validation class-validator --tests jest --ci both',
  '--orm prisma --ci none',
  '--style explicit --broker nats --cache redis',
];

const flagsOf = (stack: string): string[] => stack.split(' ').filter((flag) => flag !== '');

/** What the generated guidance must not teach any more: the token helper, the token files and the constants that stood for a port. */
const FORMER_STYLE = [
  /\btoken\(/,
  /\.ports\.ts/,
  /tokens\.ts/,
  /\[TOKENS?\]/,
  /\bDATABASE\b/,
  /EXECUTION_SCOPE/,
  /\bCLOCK\b/,
  /interfaces only/,
  /listeningContext/,
  /wire[A-Z]\w+\(/,
];

const GUIDANCE = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  ...RULE_FILES.flatMap((rule) => [`.claude/rules/${rule}.md`, `.github/instructions/${rule}.instructions.md`]),
];

describe('the guidance init writes', () => {
  it('writes a slim project guide: commands, the three reading rules, the map of the rule files, generated files, the TypeScript note, the plan and the plugin skills by their current names', () => {
    const guide = read(initProject(...NPM), 'AGENTS.md');

    const commands = [
      'npm run verify',
      'npx ddd-ts-kit check --changed-since <ref>',
      'npx ddd-ts-kit list --json',
      'npx ddd-ts-kit describe <context> --json',
      'npx ddd-ts-kit status',
      'npx ddd-ts-kit todo [<context>]',
      'npx ddd-ts-kit docs',
    ];

    const skills = [
      '/ddd-ts-kit:start',
      '/ddd-ts-kit:glossary',
      '/ddd-ts-kit:use-case',
      '/ddd-ts-kit:document',
      '/ddd-ts-kit:quality-gate',
    ];

    expect(guide.split('\n').length).toBeLessThan(40);

    for (const text of [
      ...commands,
      ...skills,
      'openapi/openapi.yaml',
      'never `npx tsc`',
      'docs/architecture/plan.md',
    ]) {
      expect(guide, text).toContain(text);
    }

    expect(guide).toMatch(
      /1\. `describe <context> --json` and the `CONTEXT\.md`[^\n]*\n2\. Open only what the `next` list[^\n]*\n3\. `check --changed-since <ref>`/,
    );

    // Skills that no longer exist.
    expect(guide).not.toMatch(/model-context|openapi-contract/);
    expect(guide).toContain('in `.claude/rules/`');
    expect(guide).toContain('`.github/instructions/<layer>.instructions.md`');
    expect(guide).toContain('Codex');

    for (const rule of RULE_FILES) {
      expect(guide).toContain(`\`${rule}.md\``);
    }

    // What is path-scoped in a rules file is not repeated for every session.
    for (const id of ['layer/domain-purity', 'tree/closed', 'naming/suffix', 'composition/only-in-module']) {
      expect(guide, id).not.toContain(id);
    }
  });

  it('says the shape every file takes in the guide, and leaves what belongs to a layer to its rule file', () => {
    const root = initProject(...NPM);
    const guide = read(root, 'AGENTS.md');

    expect(guide).toContain('one exported class, interface or function per file, named after it in kebab-case');
    expect(guide).toContain('`private` members, never `#name`');
    expect(guide).toContain('Never edit `<context>.declarations.ts`');
    expect(read(initProject(...NPM, '--style', 'explicit'), 'AGENTS.md')).not.toContain('declarations.ts');

    expect(read(root, '.claude/rules/application.md')).toContain(
      'A port is an abstract class in `ports/<name>.port.ts` and its own injection token',
    );

    expect(read(root, '.claude/rules/platform.md')).toContain('`RUN_JOBS` says whether a process runs the jobs');
    expect(read(root, '.claude/rules/platform.md')).toContain('npx ddd-ts-kit generate worker');
  });

  it('teaches that events leave with the save and that tracing stays in the platform, in the layers concerned', () => {
    const root = initProject(...NPM);
    const rule = (name: string): string => read(root, `.claude/rules/${name}.md`);

    expect(rule('application')).toContain(
      'never `pullEvents()`, never a `DomainEventDispatcher` here (`domain-events/dispatched-on-save`)',
    );

    expect(rule('infrastructure')).toContain(
      'A repository only persists: no `pullEvents()`, no dispatcher (`domain-events/dispatched-on-save`)',
    );

    expect(rule('platform')).toContain(
      '`@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported here and nowhere else (`tracing/platform-only`)',
    );

    expect(rule('platform')).toContain('spans through `kernelModule({ instrumentation })`');

    expect(read(initProject(...NPM, '--di', 'manual'), '.claude/rules/platform.md')).toContain(
      'spans through the members of `traceApplication()`',
    );

    expect(rule('published-language')).toContain(
      'One `defineIntegrationEvent({ type, version, payload })` per event and version',
    );

    expect(rule('tests')).toContain("await application.jobs.runNow('<context>.<job>')");

    expect(read(initProject(...NPM, '--di', 'manual'), '.claude/rules/tests.md')).toContain(
      'await job.run(occurrence)',
    );
  });
});

describe('the guidance of each coding agent', () => {
  it('writes the guide once, in AGENTS.md, which CLAUDE.md imports', () => {
    const root = initProject(...NPM);

    expect(read(root, 'CLAUDE.md').split('\n')[0]).toBe('@AGENTS.md');
    expect(read(root, 'CLAUDE.md').split('\n').length).toBeLessThan(6);
    expect(read(root, 'AGENTS.md')).toContain('npm run verify');
  });

  it.each(RULE_STACKS)(
    'gives Copilot the rule of each layer, scoped by applyTo to the paths of Claude Code (%s)',
    (stack) => {
      const root = initProject(...NPM, ...flagsOf(stack));

      for (const rule of RULE_FILES) {
        const claude = read(root, `.claude/rules/${rule}.md`);
        const copilot = read(root, `.github/instructions/${rule}.instructions.md`);
        const frontmatter = parseFrontmatter(copilot);

        expect(Object.keys(frontmatter), rule).toEqual(['applyTo']);
        expect(frontmatter['applyTo'], rule).toEqual([parseFrontmatter(claude)['paths']?.join(',')]);
        expect(copilot.slice(copilot.indexOf('\n---\n')), rule).toBe(claude.slice(claude.indexOf('\n---\n')));
      }
    },
  );

  it('declares the plugin for Copilot, and keeps what a project already declared', () => {
    const root = initProject(...NPM);
    const settings = JSON.parse(read(root, '.github/copilot/settings.json')) as unknown;

    expect(settings).toEqual({
      extraKnownMarketplaces: { 'ddd-ts-kit': { source: { source: 'github', repo: 'gbourgeat/ddd-ts-kit' } } },
      enabledPlugins: { 'ddd-ts-kit@ddd-ts-kit': true },
    });

    const kept = tempDir('copilot-settings');

    write(
      kept,
      '.github/copilot/settings.json',
      JSON.stringify({ model: 'x', enabledPlugins: { 'other@market': true } }),
    );

    cli(kept, 'init', '--package-manager', 'npm');

    expect(JSON.parse(read(kept, '.github/copilot/settings.json'))).toMatchObject({
      model: 'x',
      enabledPlugins: { 'other@market': true, 'ddd-ts-kit@ddd-ts-kit': true },
    });
  });
});

describe('the rule files and the README init writes', () => {
  it.each(RULE_STACKS)('renders rule files whose frontmatter holds only `paths` (%s)', (stack) => {
    const root = initProject(...NPM, ...flagsOf(stack));

    for (const rule of RULE_FILES) {
      const text = read(root, `.claude/rules/${rule}.md`);
      const frontmatter = parseFrontmatter(text);

      expect(Object.keys(frontmatter), rule).toEqual(['paths']);
      expect(frontmatter['paths']?.length, rule).toBeGreaterThan(0);

      for (const glob of frontmatter['paths'] ?? []) {
        expect(glob, rule).toMatch(/^[\w.*/-]+$/);
      }

      expect(text.trimEnd().split('\n').length, rule).toBeLessThan(25);
      expect(text.trimEnd().split('\n').at(-1), rule).toMatch(/\/ddd-ts-kit:|npx ddd-ts-kit generate/);
    }

    expect(read(root, '.claude/rules/domain.md')).toContain('  - "src/contexts/*/domain/**"');
  });

  it.each(RULE_STACKS)('teaches nothing of the former style (%s)', (stack) => {
    const root = initProject(...NPM, ...flagsOf(stack));

    for (const file of GUIDANCE) {
      for (const former of FORMER_STYLE) {
        expect(read(root, file), `${file} ${String(former)}`).not.toMatch(former);
      }
    }
  });

  it('names the rules of the ports and of the jobs where they apply', () => {
    const root = initProject(...NPM);
    const rule = (name: string): string => read(root, `.claude/rules/${name}.md`);

    expect(rule('domain')).toContain('an abstract class extending the kernel `Repository<Aggregate>`');
    expect(rule('application')).toContain('`ports/abstract-class`');
    expect(rule('application')).toContain("@Scheduled('<context>.<job>', schedule)");
    expect(rule('application')).toContain('`declarations/constructor-injection`');
    expect(rule('application')).toContain('`npx ddd-ts-kit docs` reads the signature');
    expect(rule('application')).toContain('`scheduling/job-triggers-use-case`');
    expect(rule('infrastructure')).toContain('`ports/implements-never-extends`');
    expect(rule('infrastructure')).toContain('`@Repository(InvoiceRepository)`');
    expect(rule('infrastructure')).toContain('typed by one class (`Database`, `ExecutionScope`, `Clock`');

    expect(rule('domain')).toContain('nor an exported object literal (`domain/value-object-class`)');

    expect(read(initProject(...NPM, '--values', 'free'), '.claude/rules/domain.md')).not.toContain(
      '`domain/value-object-class`',
    );

    expect(read(initProject(...NPM, '--orm', 'knex'), '.claude/rules/infrastructure.md')).toContain(
      'typed by one class (`KnexContext`, `ExecutionScope`, `Clock`',
    );
  });

  it('explains in the README how the application is put together, for the family of the stack', () => {
    const declared = read(initProject(...NPM, '--broker', 'rabbitmq'), 'README.md');
    const byHand = read(initProject(...NPM, '--di', 'manual'), 'README.md');

    expect(declared).toContain('**A port is an abstract class, and the class is what is injected.**');
    expect(declared).toContain('`kernelModule({...})` binds the ports of the kernel');
    expect(declared).toContain('`EventSubscribers` to `{ forContext: (name) => bus.forConsumer(name) }`');
    expect(declared).toContain('`src/platform/config/load-config.ts` validates the variables');
    expect(byHand).toContain('**One `Platform`, handed to each context.**');
    expect(byHand).not.toContain('kernelModule');
  });
});
