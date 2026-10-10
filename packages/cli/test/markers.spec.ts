import { describe, expect, it } from 'vitest';
import { insertInRegion, parseWiring, replaceRegion } from '../src/markers/index.js';

const file = ['// ddd-ts-kit:imports', "import a from './a.js';", '// /ddd-ts-kit:imports', 'function wire() {', '  // ddd-ts-kit:registrations', '  // /ddd-ts-kit:registrations', '  return [', '    // ddd-ts-kit:routes', '    // /ddd-ts-kit:routes', '  ];', '}'].join('\n');

describe('marker regions', () => {
  it('inserts before the closing marker with its indentation', () => {
    expect(insertInRegion(file, 'registrations', 'const b = 1;\n\nuse(b);')).toContain('  // ddd-ts-kit:registrations\n  const b = 1;\n\n  use(b);\n  // /ddd-ts-kit:registrations');
  });

  it('sets each block of statements apart by a blank line, and keeps the lines of a list together', () => {
    const statements = insertInRegion(insertInRegion(file, 'registrations', 'first();') ?? '', 'registrations', 'second();');
    const list = insertInRegion(insertInRegion(file, 'routes', 'first(),') ?? '', 'routes', 'second(),');

    expect(statements).toContain('  // ddd-ts-kit:registrations\n  first();\n\n  second();\n  // /ddd-ts-kit:registrations');
    expect(list).toContain('    // ddd-ts-kit:routes\n    first(),\n    second(),\n    // /ddd-ts-kit:routes');
  });

  it('adds an import line once, and merges the names imported from one module', () => {
    const once = insertInRegion(file, 'imports', "import a from './a.js';\nimport { b } from './b.js';") ?? '';

    expect(once.match(/import a from/g)).toHaveLength(1);
    expect(insertInRegion(once, 'imports', "import { b } from './b.js';")).toBe(once);
    expect(insertInRegion(once, 'imports', "import { c } from './b.js';")).toContain("import { b, c } from './b.js';");
  });

  it('adds a block once, and keeps two blocks that only share their first line', () => {
    const first = insertInRegion(file, 'registrations', 'on(x, () => {\n  a();\n});') ?? '';
    const second = insertInRegion(first, 'registrations', 'on(x, () => {\n  b();\n});') ?? '';

    expect(insertInRegion(second, 'registrations', 'on(x, () => {\n  a();\n});')).toBe(second);
    expect(second).toContain('  on(x, () => {\n    a();\n  });\n\n  on(x, () => {\n    b();\n  });');
  });

  it('answers undefined when the region is gone, and reads Markdown markers', () => {
    expect(insertInRegion(file, 'policies', 'x')).toBeUndefined();
    expect(replaceRegion(file, 'policies', ['x'])).toBeUndefined();

    expect(insertInRegion('<!-- ddd-ts-kit:aggregates -->\n<!-- /ddd-ts-kit:aggregates -->', 'aggregates', '- `Invoice`')).toBe(
      '<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->',
    );
  });

  it('replaces the whole content of a region', () => {
    const listed = insertInRegion(file, 'routes', 'first(),') ?? '';

    expect(replaceRegion(listed, 'routes', ['second(),', 'third(),'])).toContain('    // ddd-ts-kit:routes\n    second(),\n    third(),\n    // /ddd-ts-kit:routes');
  });

  it('splits a wiring template into regions', () => {
    const sections = [...parseWiring('@@imports\nimport a;\n@@routes\nroute(),\n')].map(([region, block]) => [region, block.trim()]);

    expect(sections).toEqual([
      ['imports', 'import a;'],
      ['routes', 'route(),'],
    ]);
  });
});
