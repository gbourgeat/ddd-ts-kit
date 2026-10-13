import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, REPO_ROOT } from './helpers.js';
import { initProject } from './support/init-project.js';
import { pipelineAsset } from './support/pipeline-asset.js';
import { readJson } from './support/read-json.js';
import { textsAt } from './support/texts-at.js';

const inRepository = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
const FORMAT_GATE = 'npm run lint && npm run format:check';

/** The kit holds the example, whose client is generated: `ddd-ts-kit sdk` adds this line to a project that asks for clients. */
const CLIENT_SOURCES = '      "!**/clients/*/src",\n';

/** The configuration of the kit as a project without clients receives it. */
const kitFormatter = (): string => inRepository('biome.json').replace(CLIENT_SOURCES, '');

/**
 * One formatter configuration in three places: the kit, the template a project receives and
 * the example. These tests are what keeps them from drifting.
 */
describe('the formatter configuration', () => {
  it('of the template is the one of the kit, byte for byte, but for the generated clients of the example', () => {
    expect(inRepository('biome.json')).toContain(CLIENT_SOURCES);
    expect(pipelineAsset('template', 'biome.json.tpl')).toBe(kitFormatter());
  });

  it('of the example extends the one of the kit instead of copying it', () => {
    expect(JSON.parse(inRepository('examples/scheduling/biome.json'))).toMatchObject({ root: false, extends: '//' });
  });

  it('formats without linting nor organising imports, at a line width of 120', () => {
    expect(JSON.parse(inRepository('biome.json'))).toMatchObject({
      formatter: { enabled: true, lineWidth: 120, indentStyle: 'space', indentWidth: 2, lineEnding: 'lf' },
      javascript: {
        formatter: { quoteStyle: 'single', trailingCommas: 'all', semicolons: 'always', arrowParentheses: 'always' },
      },
      linter: { enabled: false },
      assist: { enabled: false },
    });
  });

  it('is pinned to the same version in the kit, in the example and in a generated project', () => {
    const pinned = (file: string): string | undefined =>
      textsAt(JSON.parse(inRepository(file)), 'devDependencies')['@biomejs/biome'];

    expect(pinned('package.json')).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pinned('examples/scheduling/package.json')).toBe(pinned('package.json'));
    expect(pinned('pipeline/package-scripts.json')).toBe(pinned('package.json'));
    expect(inRepository('biome.json')).toContain(`/schemas/${pinned('package.json') ?? ''}/schema.json`);
  });
});

describe('a project init writes', () => {
  it('carries the configuration of the kit, the two scripts, the gate and the hook', () => {
    const root = initProject('--package-manager', 'npm');
    const scripts = textsAt(readJson(root, 'package.json'), 'scripts');

    expect(read(root, 'biome.json')).toBe(kitFormatter());
    expect(scripts).toMatchObject({ format: 'biome format --write .', 'format:check': 'biome format .' });
    expect(scripts['ci:format']).toBe('npm run format:check');
    expect(scripts['verify']).toContain(FORMAT_GATE);
    expect(read(root, 'lefthook.yml')).toContain('biome format --no-errors-on-unmatched {staged_files}');
  });

  it.each(['.github/workflows/ci.yml', '.gitlab-ci.yml'])('checks the format in the lint job of %s', (file) => {
    expect(read(initProject('--ci', 'both', '--package-manager', 'npm'), file)).toMatch(
      /npm run ci:format\n(\s+(- name|env|LINT|#).*\n)*\s+(- )?(run: )?npm run ci:lint/,
    );
  });

  it('holds the same gate in the example and in the kit', () => {
    expect(textsAt(JSON.parse(inRepository('examples/scheduling/package.json')), 'scripts')['verify']).toContain(
      FORMAT_GATE,
    );

    expect(inRepository('.github/workflows/ci.yml')).toContain('npm run ci:format');
    expect(inRepository('.gitlab-ci.yml')).toContain('npm run ci:format');
  });
});

describe('the jest config init writes', () => {
  const jestConfig = (...flags: string[]): string => read(initProject('--tests', 'jest', ...flags), 'jest.config.js');

  it('compiles standard decorators when no library of the stack needs the legacy ones', () => {
    const config = jestConfig();

    expect(config).toContain("transform: { decoratorVersion: '2022-03' },");
    expect(config).not.toContain('legacyDecorator');
    expect(config).not.toContain('decoratorMetadata');
    expect(config).not.toContain('{{');
  });

  it.each([
    ['--validation', 'class-validator'],
    ['--http', 'nest'],
  ])('compiles legacy decorators with %s %s', (...flags) => {
    const config = jestConfig(...flags);

    expect(config).toContain('transform: { legacyDecorator: true, decoratorMetadata: true },');
    expect(config).not.toContain('decoratorVersion');
  });
});
