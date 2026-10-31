import { describe, expect, it } from 'vitest';
import { withNamedImports } from '../src/init/with-named-imports';

describe('the imports of the lines init --force keeps', () => {
  const existing = [
    "import { a, b } from './one';",
    "import type { Shown } from './two';",
    "import Whole from './whole';",
    "import * as all from './all';",
    "import './side-effect';",
    '',
  ].join('\n');

  it('adds what the lines name and the text does not import, narrowed to it, the other names left out', () => {
    expect(withNamedImports("import { b } from './other';\n", existing, ['a(Shown);'])).toBe(
      "import { b } from './other';\nimport { a } from './one';\nimport type { Shown } from './two';\n",
    );
  });

  it('writes a statement back whole when a generator only added names to it', () => {
    expect(withNamedImports("import { b } from './one';\n", existing, ['a(b);'])).toBe(
      "import { a, b } from './one';\n",
    );
  });

  it('adds a default and a namespace import as they stand, to a text without imports first', () => {
    expect(withNamedImports('const x = 1;\n', existing, ['Whole(all);'])).toBe(
      "import Whole from './whole';\nimport * as all from './all';\nconst x = 1;\n",
    );
  });

  it('adds nothing a line does not name, or that a statement cannot be narrowed to', () => {
    expect(withNamedImports('const x = 1;\n', existing, ['y();'])).toBe('const x = 1;\n');

    expect(
      withNamedImports("import { Other } from './whole';\n", "import Whole, { Other } from './whole';\n", ['Whole();']),
    ).toBe("import { Other } from './whole';\n");
  });
});
