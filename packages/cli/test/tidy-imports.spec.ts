import { describe, expect, it } from 'vitest';
import { tidyImports } from '../src/value-objects/tidy-imports.js';

describe('the imports of a file whose value objects now throw', () => {
  it('adds expectRefusal to the import of the testing package an assertion now calls', () => {
    const source = [
      "import { describe, it } from 'vitest';",
      "import { aClock } from '@ddd-ts-kit/testing';",
      '',
      "it('refuses', () => expectRefusal(() => Email.of('x'), 'email.invalid'));",
      '',
    ].join('\n');

    expect(tidyImports(source)).toBe(source.replace('{ aClock }', '{ aClock, expectRefusal }'));
  });

  it('imports expectRefusal at the top of a file that has no import at all', () => {
    const source = "it('refuses', () => expectRefusal(() => Email.of('x'), 'email.invalid'));\n";

    expect(tidyImports(source)).toBe(`\nimport { expectRefusal } from '@ddd-ts-kit/testing';${source}`);
  });

  it('keeps the helpers of the kernel the file still reads, and drops the ones it no longer does', () => {
    const source = [
      "import { type Result, err, ok, Clock } from '@ddd-ts-kit/kernel';",
      '',
      'export const read = (clock: Clock): Result<string, string> => ok(clock.now().toISOString());',
      '',
    ].join('\n');

    expect(tidyImports(source)).toBe(source.replace('type Result, err, ok, Clock', 'type Result, ok, Clock'));
  });
});
