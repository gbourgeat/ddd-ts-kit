import { describe, expect, it } from 'vitest';
import { scan } from '../src/check/scanner.js';

const specifiers = (source: string): string[] => scan(source).imports.map((record) => `${record.kind}:${record.specifier}`);

describe('import scanner', () => {
  it('finds every form of import', () => {
    const source = [
      "import a from 'a';",
      "import { b, c as d } from 'b';",
      "import * as e from 'e';",
      "import type { F } from 'f';",
      "import g, { type H } from 'g';",
      "import 'side-effect';",
      "export { i } from 'i';",
      "export * from 'j';",
      "export type { K } from 'k';",
      "const l = await import('l');",
      "const m = require('m');",
      "import n = require('n');",
      "type O = import('o').O;",
      'import p from "p";',
      'import q from `q`;',
    ].join('\n');

    expect(specifiers(source)).toEqual([
      'import:a',
      'import:b',
      'import:e',
      'import:f',
      'import:g',
      'side-effect:side-effect',
      'export:i',
      'export:j',
      'export:k',
      'dynamic:l',
      'require:m',
      'require:n',
      'dynamic:o',
      'import:p',
      'import:q',
    ]);
  });

  it('reports the line of the statement, the local names and type-only imports', () => {
    const [first, second] = scan("\n\nimport type {\n  A,\n  B as C,\n} from './x.js';\nimport D, * as E from 'y';\n").imports;

    expect(first).toMatchObject({ line: 3, typeOnly: true, names: ['A', 'C'] });
    expect(second).toMatchObject({ line: 7, typeOnly: false, names: ['D', 'E'] });
  });

  it('ignores imports written in comments, strings, templates and regular expressions', () => {
    const source = [
      "// import a from 'a';",
      "/* import b from 'b';",
      "   require('c') */",
      "const d = \"import d from 'd'\";",
      "const e = 'require(\"e\")';",
      "const f = `import('f') ${g ? `require('h')` : ''} from 'i'`;",
      "const j = /import 'j'/;",
      "const k = x / 2; const l = y / 3; // import('m')",
      "/** @see import('n') */",
    ].join('\n');

    expect(specifiers(source)).toEqual([]);
  });

  it('still sees code inside a template interpolation', () => {
    expect(specifiers("const a = `${require('a')} text`;")).toEqual(['require:a']);
  });

  it('does not take a property or a longer identifier for an import', () => {
    expect(specifiers("loader.import('a'); myrequire('b'); x.require('c'); const from = 'd'; Array.from('e');")).toEqual([]);
  });

  it('attributes each specifier to its own statement when semicolons are missing', () => {
    const source = "export { a }\nimport b from 'b'\nexport const c = 1\nexport * from 'd'\n";

    expect(specifiers(source)).toEqual(['import:b', 'export:d']);
  });

  it('keeps line numbers after multi-line comments and templates', () => {
    const records = scan("/*\n\n*/\nconst t = `\n\n`;\nimport a from 'a';\n").imports;

    expect(records[0]?.line).toBe(7);
  });

  it('collects comments with their line and whether they stand alone', () => {
    const { comments } = scan("const a = 1; // trailing\n// alone\n");

    expect(comments).toMatchObject([
      { line: 1, text: 'trailing', ownLine: false },
      { line: 2, text: 'alone', ownLine: true },
    ]);
  });

  it('collects block comments with their extent and tells JSDoc apart', () => {
    const { blockComments } = scan('/* plain */\n/**\n * Documented.\n */\nconst a = 1;\n');

    expect(blockComments).toMatchObject([
      { line: 1, endLine: 1, jsdoc: false, text: ' plain ' },
      { line: 2, endLine: 4, jsdoc: true },
    ]);
  });
});
