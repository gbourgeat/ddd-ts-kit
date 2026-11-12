import { describe, expect, it } from 'vitest';
import { CONFIG_FILE } from '../src/config';
import { config } from '../src/check/fixtures/config';
import { project } from '../src/check/fixtures/project';
import { runFixture } from '../src/check/fixtures/run-fixture';

const SETUP = 'test/support/test-database-setup.ts';
const RULE = 'imports/alias-only';

/** What `check` tells to write for each import of the global setup, in a project that holds `files` beside it. */
function fixesOf(imports: readonly string[], files: Readonly<Record<string, string>>): string[] {
  const setup = imports.map((specifier, index) => `import * as neighbour${index} from '${specifier}';\n`).join('');

  const { violations } = runFixture({
    ruleId: RULE,
    name: '',
    expect: 'pass',
    files: project({ ...files, [SETUP]: setup }),
  });

  return violations.filter(({ ruleId }) => ruleId === RULE).map(({ fix }) => /'([^']+)'/.exec(fix)?.[1] ?? fix);
}

const NEIGHBOURS = {
  'test/support/run.ts': 'export const run = 1;\n',
  'test/support/esm.mts': 'export const esm = 1;\n',
  'test/support/common.cts': 'export const common = 1;\n',
  'test/support/data.json': '{}\n',
  'test/support/helper.js': 'export const help = 1;\n',
  'test/support/parts/index.ts': 'export const part = 1;\n',
};

describe('what check tells to write for a neighbour of test/support', () => {
  it('under ".js", is the source that exists, a file named as it is being left alone', () => {
    const imports = ['./run.js', './run', './esm.mjs', './common.cjs', './data.json', './helper.js', './run.ts'];

    expect(fixesOf(imports, NEIGHBOURS)).toEqual(['./run.ts', './run.ts', './esm.mts', './common.cts']);
  });

  it('under ".js", is nothing for a name no source answers: the compiler reports it', () => {
    expect(fixesOf(['./absent.js', './absent', './absent.json'], NEIGHBOURS)).toEqual([]);
  });

  it('without an extension, is the ".ts" source without it, an ".mts" source, a JSON file and a JavaScript file being left alone', () => {
    const bare = { ...NEIGHBOURS, [CONFIG_FILE]: config({ importExtension: 'none' }) };
    const imports = ['./run.ts', './run.js', './esm.mts', './data.json', './helper.js', './run'];

    expect(fixesOf(imports, bare)).toEqual(['./run', './run']);
  });

  it('is the alias of the index file for a directory, which is no neighbour, with the ending the project writes', () => {
    const bare = { ...NEIGHBOURS, [CONFIG_FILE]: config({ importExtension: 'none' }) };

    expect(fixesOf(['./parts'], NEIGHBOURS)).toEqual(['$test/support/parts/index.js']);
    expect(fixesOf(['./parts'], bare)).toEqual(['$test/support/parts']);
  });
});
