import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatJson } from '../src/json/format-json.js';
import { REPO_ROOT } from './helpers.js';

const LONG = Array.from({ length: 12 }, (_, index) => `src/contexts/*/test/integration/${index}.spec.ts`);

const SAMPLE = {
  name: 'billing',
  private: true,
  nothing: null,
  left: undefined,
  include: ['src', 'test'],
  empty: [],
  none: {},
  entry: LONG,
  pairs: [
    ['a', 1],
    ['b', 2],
  ],
  roles: [{ name: 'admin', scopes: ['read', 'write'] }],
  nested: { deep: { values: [1, 2, 3], text: 'a, "quoted" value' } },
};

describe('formatJson', () => {
  it('writes an object one key per line and a list of plain values on one line when it fits', () => {
    expect(formatJson({ name: 'billing', include: ['src', 'test'], none: {}, roles: [{ name: 'admin' }] })).toBe(
      [
        '{',
        '  "name": "billing",',
        '  "include": ["src", "test"],',
        '  "none": {},',
        '  "roles": [',
        '    {',
        '      "name": "admin"',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('holds the value JSON.stringify would write', () => {
    expect(JSON.parse(formatJson(SAMPLE))).toEqual(JSON.parse(JSON.stringify(SAMPLE)));
  });

  it('is what the formatter of the project prints: Biome finds nothing to change', () => {
    const biome = path.join(REPO_ROOT, 'node_modules/.bin/biome');
    const written = formatJson(SAMPLE);

    const formatted = execFileSync(biome, ['format', `--stdin-file-path=${path.join(REPO_ROOT, 'sample.json')}`], {
      cwd: REPO_ROOT,
      input: written,
      encoding: 'utf8',
    });

    expect(formatted).toBe(written);
  });
});
