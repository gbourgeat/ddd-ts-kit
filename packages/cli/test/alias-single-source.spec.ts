import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { checkJsonOf } from './check-support';
import { initProject } from './support/init-project';

const RULE = 'imports/alias-declared';
const READS_TSCONFIG = /\n\s*resolve: \{ tsconfigPaths: true \},/;
const JEST = ['--tests', 'jest', '--di', 'manual', '--validation', 'none', '--orm', 'custom'];

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

const RESOLUTION = /"module" and "moduleResolution" of tsconfig\.json are not what "importExtension" gives/;
const WITH_JS = ['--import-extension', 'js'];

/** The three declarations derived from "importExtension": how the compiler resolves, what jest maps, what the build writes. */
const EXTENSION_MUTATIONS: readonly Mutation[] = [
  {
    what: 'tsconfig.json resolves as Node does although the imports carry no extension',
    file: 'tsconfig.json',
    change: swap('"moduleResolution": "Bundler"', '"moduleResolution": "NodeNext"'),
    finding: RESOLUTION,
  },
  {
    what: 'tsconfig.json emits another module format than the one the build completes',
    file: 'tsconfig.json',
    change: swap('"module": "ESNext"', '"module": "CommonJS"'),
    finding: RESOLUTION,
  },
  {
    what: 'tsconfig.json no longer gives the compiler the entry a package has for Node',
    file: 'tsconfig.json',
    change: swap('"customConditions": ["node"]', '"customConditions": []'),
    finding: RESOLUTION,
  },
  {
    what: 'tsconfig.build.json resolves another way than the type check',
    file: 'tsconfig.build.json',
    change: swap(
      '"extends": "./tsconfig.json",',
      '"extends": "./tsconfig.json",\n  "compilerOptions": { "module": "NodeNext", "moduleResolution": "NodeNext" },',
    ),
    finding: /"module" and "moduleResolution" of tsconfig\.build\.json are not what "importExtension" gives/,
  },
  {
    what: 'the config asks for ".js" and tsconfig.json does not follow',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importExtension": "none"', '"importExtension": "js"'),
    reportedIn: 'tsconfig.json',
    finding: RESOLUTION,
  },
  {
    what: 'the config drops the extension and tsconfig.json does not follow',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importExtension": "js"', '"importExtension": "none"'),
    reportedIn: 'tsconfig.json',
    finding: RESOLUTION,
    flags: WITH_JS,
  },
  {
    what: 'tsconfig.json resolves as a bundler although the imports end with ".js"',
    file: 'tsconfig.json',
    change: swap('"moduleResolution": "NodeNext"', '"moduleResolution": "Bundler"'),
    finding: RESOLUTION,
    flags: WITH_JS,
  },
  {
    what: 'the jest config maps a specifier with ".js" although the imports carry none',
    file: 'jest.config.js',
    change: swap("'^@/(.*)$'", String.raw`'^@/(.*)\.js$'`),
    finding: /jest\.config\.js does not map the import alias "\^@\/\(\.\*\)\$"/,
    flags: JEST,
  },
  {
    what: 'the jest config maps a specifier without ".js" although the imports end with it',
    file: 'jest.config.js',
    change: swap(String.raw`'^@/(.*)\\.js$'`, "'^@/(.*)$'"),
    finding: /jest\.config\.js does not map the import alias "\^@\/\(\.\*\)\\\.js\$"/,
    flags: [...JEST, ...WITH_JS],
  },
  {
    what: 'the build script of a project without extensions loses the step that writes them',
    file: 'package.json',
    change: swap(' && ddd-ts-kit build-aliases', ''),
    finding: /The script "build" compiles and does not run `ddd-ts-kit build-aliases` afterwards/,
  },
];

/** Each declaration a tool reads, moved away from the one the config gives: `check` names the file and what to write. */
const MUTATIONS: readonly Mutation[] = [
  {
    what: 'tsconfig.json loses the entry of the source root',
    file: 'tsconfig.json',
    change: swap(/"@\/\*": \[[^\]]*\],\n\s*/, ''),
    finding: /tsconfig\.json declares no "paths" entry for "@\/\*"/,
  },
  {
    what: 'tsconfig.json points the alias at the compiled files',
    file: 'tsconfig.json',
    change: swap('"@/*": ["./src/*"]', '"@/*": ["./dist/src/*"]'),
    finding: /The "paths" entry "@\/\*" of tsconfig\.json is not what "importAlias" gives/,
  },
  {
    what: 'tsconfig.json points the alias of the tests elsewhere',
    file: 'tsconfig.json',
    change: swap('"$test/*": ["./test/*"]', '"$test/*": ["./src/test/*"]'),
    finding: /The "paths" entry "\$test\/\*" of tsconfig\.json/,
  },
  {
    what: 'tsconfig.json gains a second entry under the alias',
    file: 'tsconfig.json',
    change: swap('"$test/*"', '"@/platform/*": ["./src/platform/*"],\n      "$test/*"'),
    finding: /"@\/platform\/\*" of tsconfig\.json starts with an alias of the project/,
  },
  {
    what: 'tsconfig.json sets a baseUrl, which moves every target',
    file: 'tsconfig.json',
    change: swap('"outDir": "dist"', '"outDir": "dist",\n    "baseUrl": "./src"'),
    finding: /tsconfig\.json sets "baseUrl"/,
  },
  {
    what: 'tsconfig.build.json declares paths of its own',
    file: 'tsconfig.build.json',
    change: swap(
      '"extends": "./tsconfig.json",',
      '"extends": "./tsconfig.json",\n  "compilerOptions": { "paths": { "@/*": ["./lib/*"] } },',
    ),
    finding: /The "paths" entry "@\/\*" of tsconfig\.build\.json is not what "importAlias" gives/,
  },
  {
    what: 'the build script loses the rewrite step',
    file: 'package.json',
    change: swap(' && ddd-ts-kit build-aliases', ''),
    finding: /The script "build" compiles and does not run `ddd-ts-kit build-aliases` afterwards/,
  },
  {
    what: 'another script compiles on its own',
    file: 'package.json',
    change: swap('"scripts": {', '"scripts": {\n    "compile": "tsc -p tsconfig.build.json",'),
    finding: /The script "compile" compiles and does not run/,
  },
  {
    what: 'the dev script runs under another tsconfig',
    file: 'package.json',
    change: swap('tsx watch ', 'tsx watch --tsconfig tsconfig.dev.json '),
    finding: /The script "dev" runs the sources with tsx under tsconfig\.dev\.json/,
  },
  {
    what: 'the vitest config no longer reads tsconfig',
    file: 'vitest.config.ts',
    change: swap(READS_TSCONFIG, ''),
    finding: /vitest\.config\.ts does not resolve the import alias from tsconfig\.json/,
  },
  {
    what: 'the end-to-end vitest config no longer reads tsconfig',
    file: 'vitest.e2e.config.ts',
    change: swap(READS_TSCONFIG, ''),
    finding: /vitest\.e2e\.config\.ts does not resolve the import alias from tsconfig\.json/,
  },
  {
    what: 'the jest config loses the mapping of the source root',
    file: 'jest.config.js',
    change: swap(/\n\s*'\^@\/\(\.\*\)\$': '<rootDir>\/src\/\$1\.ts',/, ''),
    finding: /jest\.config\.js does not map the import alias "\^@\/\(\.\*\)\$"/,
    flags: JEST,
  },
  {
    what: 'the jest config maps the alias to the compiled files',
    file: 'jest.config.js',
    change: swap("'<rootDir>/src/$1.ts'", "'<rootDir>/dist/src/$1.js'"),
    finding: /jest\.config\.js does not map the import alias/,
    flags: JEST,
  },
  {
    what: 'the dependency-cruiser config no longer reads tsconfig',
    file: '.dependency-cruiser.cjs',
    change: swap(/\s*"tsConfig": \{\s*"fileName": "tsconfig\.json"\s*\},/, ''),
    finding: /\.dependency-cruiser\.cjs does not resolve the import alias from tsconfig\.json/,
  },
  {
    what: 'knip is given a path of its own for the alias',
    file: 'knip.json',
    change: swap('"entry"', '"paths": { "@/*": ["./src/*"] },\n  "entry"'),
    finding: /knip\.json maps "@\/\*" under "paths"/,
  },
  {
    what: 'the config renames the alias and nothing follows',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "@/"', '"importAlias": "$app/"'),
    reportedIn: 'tsconfig.json',
    finding: /tsconfig\.json declares no "paths" entry for "\$app\/\*"/,
  },
  {
    what: 'the config goes back to a subpath import',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "@/"', '"importAlias": "#app/"'),
    finding: /"importAlias" is "#app\/", which is not supported/,
  },
  {
    what: 'the config takes a prefix any package could have',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "@/"', '"importAlias": "app/"'),
    finding: /"importAlias" is "app\/", which is not supported/,
  },
  {
    what: 'the config takes the name of a scope, which a package could be installed under',
    file: 'ddd-ts-kit.config.json',
    change: swap('"importAlias": "@/"', '"importAlias": "@app/"'),
    finding: /"importAlias" is "@app\/", which is not supported: it is also how the packages of a scope are named/,
  },
  {
    what: 'the jest config loses the mapping of the tests',
    file: 'jest.config.js',
    change: swap(/\n\s*'\^\\\\\$test\/\(\.\*\)\$': '<rootDir>\/test\/\$1\.ts',/, ''),
    finding: /jest\.config\.js does not map the import alias "\^\\\$test\//,
    flags: JEST,
  },
  ...EXTENSION_MUTATIONS,
];

describe('the import alias has one declaration', () => {
  it.each([
    [[]],
    [['--tests', 'jest']],
    [['--orm', 'prisma']],
    [['--http', 'nest']],
    [['--http', 'none', '--orm', 'none']],
    [WITH_JS],
    [[...JEST, ...WITH_JS]],
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
    const generated = read(root, '.dependency-cruiser.cjs');

    expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
    expect(generated).toMatch(/"tsConfig": \{\s*"fileName": "tsconfig\.json"\s*\}/);

    write(
      root,
      '.dependency-cruiser.cjs',
      generated.replace('"fileName": "tsconfig.json"', '"fileName": "other.json"'),
    );

    expect(cli(root, 'depcruise-config', '--check').code).not.toBe(0);
  });
});
