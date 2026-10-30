import { describe, expect, it } from 'vitest';
import { rewriteSpecifiers } from '../src/build';

const ROOTS = [
  { prefix: '@/', directory: 'src' },
  { prefix: '$test/', directory: 'test' },
  { prefix: '$scripts/', directory: 'scripts' },
];

/** Every alias becomes `<the path after the prefix>` under `./out/`, so a test reads what was rewritten. */
const toOut = (source: string): ReturnType<typeof rewriteSpecifiers> =>
  rewriteSpecifiers(source, { roots: ROOTS, relativeOf: (specifier) => `./out/${specifier.split('/').at(-1)}` });

const EVERY_POSITION = [
  "import a from '@/a.js';",
  "import { b, c as d } from '@/b.js';",
  "import * as e from '@/e.js';",
  "import type { F } from '@/f.js';",
  "import g, { type H } from '@/g.js';",
  "import '@/side-effect.js';",
  "export { i } from '@/i.js';",
  "export * from '@/j.js';",
  "export * as k from '@/k.js';",
  "export type { L } from '@/l.js';",
  "const m = await import('@/m.js');",
  'const n = await import("@/n.js");',
  'const o = await import(`@/o.js`);',
  "const p = await import('@/p.js', { with: { type: 'json' } });",
  "const q = require('@/q.js');",
  "const r = import.meta.resolve('@/r.js');",
  'export declare const s: () => Promise<typeof import("@/s.js")>;',
  "export type T = import('@/t.js').T;",
  "declare module '@/u.js' {}",
  "import {\n  v,\n  w,\n} from '$scripts/v.js';",
];

const NEVER_A_SPECIFIER = [
  'const text = "import a from \'@/a.js\'";',
  "const label = '@/a.js';",
  "log('@/a.js');",
  "const from = ['@/a.js'];",
  "// import a from '@/a.js';",
  "/* export * from '@/a.js'; */",
  "/** @example import('@/a.js') */",
  "const template = `import('@/a.js') and from '@/a.js'`;",
  "const pattern = /from '@\\/a.js'/;",
  "const nested = `${value} from '@/a.js'`;",
  "object.import('@/a.js');",
  "object.require('@/a.js');",
  "import { kernel } from '@ddd-ts-kit/kernel';",
  "import { near } from './near.js';",
  "export * from '@testing-library/dom';",
];

describe('rewriting the alias specifiers of an emitted file', () => {
  it('rewrites every position a module specifier is read from, static, dynamic and in declarations', () => {
    const { text, count, problems } = toOut(EVERY_POSITION.join('\n'));

    expect(problems).toEqual([]);
    expect(count).toBe(EVERY_POSITION.length);
    expect(text).not.toMatch(/['"`]@(?:scripts)?\//);

    expect(text.split('\n').slice(0, 3)).toEqual([
      "import a from './out/a.js';",
      "import { b, c as d } from './out/b.js';",
      "import * as e from './out/e.js';",
    ]);

    expect(text).toContain('Promise<typeof import("./out/s.js")>');
    expect(text).toContain('await import(`./out/o.js`)');
    expect(text).toContain("await import('./out/p.js', { with: { type: 'json' } })");
    expect(text).toContain("import.meta.resolve('./out/r.js')");
    expect(text).toContain("declare module './out/u.js' {}");
    expect(text).toContain("} from './out/v.js';");
  });

  it('leaves alone a string that only looks like an import: other code, comments, templates, regular expressions, packages', () => {
    const source = NEVER_A_SPECIFIER.join('\n');

    expect(toOut(source)).toEqual({ text: source, count: 0, problems: [] });
  });

  it('keeps every line where it was, and is idempotent', () => {
    const source = [...EVERY_POSITION, ...NEVER_A_SPECIFIER].join('\n');
    const once = toOut(source);
    const twice = toOut(once.text);

    expect(once.text.split('\n').length).toBe(source.split('\n').length);
    expect(twice).toEqual({ text: once.text, count: 0, problems: [] });
  });

  it.each([
    [
      'a template completed at run time',
      'const m = await import(`@/handlers/${name}.js`);',
      /line 1: a dynamic import/,
    ],
    [
      'a concatenation',
      "const m = await import('@/handlers/' + name);",
      /line 1: a dynamic import starts with "@\/handlers\/"/,
    ],
    [
      'a require completed at run time',
      "\nconst m = require('@/handlers/' + name);",
      /line 2: a dynamic import starts with/,
    ],
  ])('reports %s instead of rewriting half of it', (_what, source, problem) => {
    const { text, count, problems } = toOut(source);

    expect(text).toBe(source);
    expect(count).toBe(0);
    expect(problems.join('\n')).toMatch(problem);
  });

  it('reports an alias that names no emitted file, and still rewrites nothing of a computed import of another module', () => {
    const missing = rewriteSpecifiers("import a from '@/a.js';\nimport b from '$test/b.js';", {
      roots: ROOTS,
      relativeOf: (specifier) => (specifier.startsWith('$test/') ? undefined : './a.js'),
    });

    expect(missing.problems).toEqual(['line 2: "$test/b.js" names no file the build emitted']);
    expect(toOut('const m = await import(`./handlers/${name}.js`);').problems).toEqual([]);
  });
});
