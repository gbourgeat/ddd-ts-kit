import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { checkJsonOf } from './check-support.js';
import { initProject } from './support/init-project.js';

const RULE = 'imports/alias-declared';
const CONDITION = 'ddd-ts-kit-source';

interface Mutation {
  readonly what: string;
  /** The derived declaration that is changed. */
  readonly file: string;
  readonly change: (text: string) => string;
  /** Where the finding is reported, when it is not the file changed. */
  readonly reportedIn?: string;
  readonly finding: RegExp;
  readonly flags?: readonly string[];
}

const swap = (from: string | RegExp, to: string) => (text: string) => text.replace(from, to);

/** Each declaration a tool reads, moved away from the one the config and tsconfig give: `check` names the file and what to write. */
const MUTATIONS: readonly Mutation[] = [
  {
    what: 'package.json loses the entry of the source root',
    file: 'package.json',
    change: swap(/"#src\/\*\.js": \{[^}]*\},\n\s*/, ''),
    finding: /package\.json declares no "imports" entry for "#src\/\*\.js"/,
  },
  {
    what: 'package.json names another compiled directory than tsconfig writes to',
    file: 'package.json',
    change: swap('"default": "./dist/src/*.js"', '"default": "./build/src/*.js"'),
    finding:
      /The "imports" entry "#src\/\*\.js" of package\.json is not what "importAlias" and the tsconfig of the build give/,
  },
  {
    what: 'package.json answers the sources of the tests under a condition',
    file: 'package.json',
    change: swap('"#test/*.js": "./test/*.ts"', `"#test/*.js": { "${CONDITION}": "./test/*.ts" }`),
    finding: /The "imports" entry "#test\/\*\.js"/,
  },
  {
    what: 'package.json gains a second entry under the alias',
    file: 'package.json',
    change: swap('"#test/*.js"', '"#src/platform/*.js": "./src/platform/*.ts",\n    "#test/*.js"'),
    finding: /"#src\/platform\/\*\.js" of package\.json starts with an alias of the project/,
  },
  {
    what: 'the dev script loses the source condition',
    file: 'package.json',
    change: swap(`tsx watch --conditions=${CONDITION} `, 'tsx watch '),
    finding: /The script "dev" runs the sources with tsx without the condition "ddd-ts-kit-source"/,
  },
  {
    what: 'drizzle-kit is run without the source condition',
    file: 'package.json',
    change: swap(`node --conditions=${CONDITION} node_modules/drizzle-kit/bin.cjs generate`, 'drizzle-kit generate'),
    finding: /The script "db:generate" runs the sources with drizzle-kit without the condition/,
  },
  {
    what: 'tsconfig.json maps the alias itself',
    file: 'tsconfig.json',
    change: swap('"outDir": "dist"', '"outDir": "dist",\n    "paths": { "#src/*": ["./src/*"] }'),
    finding: /tsconfig\.json maps "#src\/\*" under "paths"/,
  },
  {
    what: 'tsconfig.json writes the build elsewhere',
    file: 'tsconfig.json',
    change: swap('"outDir": "dist"', '"outDir": "build"'),
    reportedIn: 'package.json',
    finding: /"#src\/\*\.js" of package\.json is not what "importAlias" and the tsconfig of the build give/,
  },
  {
    what: 'tsconfig.build.json writes elsewhere than the type check maps',
    file: 'tsconfig.build.json',
    change: swap(
      '"extends": "./tsconfig.json",',
      '"extends": "./tsconfig.json",\n  "compilerOptions": { "outDir": "out" },',
    ),
    finding:
      /tsconfig\.json \(rootDir "\.", outDir "dist"\) and tsconfig\.build\.json \(rootDir "\.", outDir "out"\) do not write to the same place/,
  },
  {
    what: 'the vitest config loses the source condition',
    file: 'vitest.config.ts',
    change: swap(/\n\s*ssr: \{ resolve: \{ conditions: \['ddd-ts-kit-source'\] \} \},/, ''),
    finding: /vitest\.config\.ts does not set the condition "ddd-ts-kit-source"/,
  },
  {
    what: 'the end-to-end vitest config loses the source condition',
    file: 'vitest.e2e.config.ts',
    change: swap(/\n\s*ssr: \{ resolve: \{ conditions: \['ddd-ts-kit-source'\] \} \},/, ''),
    finding: /vitest\.e2e\.config\.ts does not set the condition/,
  },
  {
    what: 'the jest config loses the source condition',
    file: 'jest.config.js',
    change: swap(`'${CONDITION}', `, ''),
    finding: /jest\.config\.js does not set the condition/,
    flags: ['--tests', 'jest', '--di', 'manual', '--validation', 'none', '--orm', 'custom'],
  },
  {
    what: 'the dependency-cruiser config loses the source condition',
    file: '.dependency-cruiser.cjs',
    change: swap(/\s*"ddd-ts-kit-source",/, ''),
    finding: /\.dependency-cruiser\.cjs does not resolve under the condition/,
  },
  {
    what: 'knip is given a path of its own for the alias',
    file: 'knip.json',
    change: swap('"entry"', '"paths": { "#src/*": ["./src/*"] },\n  "entry"'),
    finding: /knip\.json maps "#src\/\*" under "paths"/,
  },
  {
    what: 'the config renames the alias and nothing follows',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "#src/"', '"importAlias": "#app/"'),
    reportedIn: 'package.json',
    finding: /package\.json declares no "imports" entry for "#app\/\*\.js"/,
  },
  {
    what: 'the config goes back to a tsconfig path',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "#src/"', '"importAlias": "@/"'),
    finding: /"importAlias" is "@\/", which is not supported/,
  },
];

describe('the import alias has one declaration', () => {
  it.each([
    [[]],
    [['--tests', 'jest']],
    [['--orm', 'prisma']],
    [['--http', 'nest']],
    [['--http', 'none', '--orm', 'none']],
  ])('which init writes consistently (%j)', (flags) => {
    const found = checkJsonOf(cli(initProject(...flags), 'check', '--json')).violations;

    expect(found.filter(({ ruleId }) => ruleId.startsWith('imports/'))).toEqual([]);
  });

  it.each(MUTATIONS.map((mutation) => [mutation.what, mutation] as const))('%s: check names it', (_what, mutation) => {
    const root = initProject(...(mutation.flags ?? []));
    const before = read(root, mutation.file);

    write(root, mutation.file, mutation.change(before));

    const result = cli(root, 'check', '--rule', RULE, '--json');
    const found = checkJsonOf(result).violations.filter(({ ruleId }) => ruleId === RULE);

    expect(read(root, mutation.file)).not.toBe(before);
    expect(result.code).toBe(1);
    expect(found.map(({ file }) => file)).toContain(mutation.reportedIn ?? mutation.file);
    expect(found.map(({ message }) => message).join('\n')).toMatch(mutation.finding);
    expect(found.every(({ fix }) => fix.length > 20)).toBe(true);
  });

  it('is also held by the generated dependency-cruiser config, which `depcruise-config --check` compares with the config', () => {
    const root = initProject();

    expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
    expect(read(root, '.dependency-cruiser.cjs')).toContain(`"${CONDITION}",\n        "import"`);

    write(root, '.dependency-cruiser.cjs', read(root, '.dependency-cruiser.cjs').replace(`"${CONDITION}",`, ''));

    expect(cli(root, 'depcruise-config', '--check').code).not.toBe(0);
  });
});
