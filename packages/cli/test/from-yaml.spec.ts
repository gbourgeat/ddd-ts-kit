import { describe, expect, it } from 'vitest';
import { fromYaml } from '../src/yaml/from-yaml.js';
import { toYaml } from '../src/yaml/to-yaml.js';
import { YamlShapeError } from '../src/yaml/yaml-shape-error.js';
import { read, REPO_ROOT } from './helpers.js';
import { readYaml } from './support/read-yaml.js';
import { AWKWARD, SHAPES, TEXTS } from './support/yaml-samples.js';

describe('fromYaml', () => {
  it('reads back every value toYaml writes', () => {
    const values = [AWKWARD, TEXTS, SHAPES, 'just text', 7, 'top\nblock\n', {}, [], null, [[['deep']]]];

    for (const value of values) {
      expect(fromYaml(toYaml(value))).toEqual(value);
    }
  });

  it('reads a literal block in a list and in a map nested in a list', () => {
    const value = [{ a: 'x\ny\n', b: [{ c: 'kept\n\n' }] }, 'end\n'];

    expect(fromYaml(toYaml(value))).toEqual(value);
  });

  it('reads the contract of the example as a YAML 1.2 parser does', () => {
    const text = read(REPO_ROOT, 'examples/scheduling/openapi/openapi.yaml');

    expect(fromYaml(text)).toEqual(readYaml([text])[0]?.yaml12);
  });

  it('takes a text with Windows line breaks', () => {
    expect(fromYaml('a:\r\n  - 1\r\n')).toEqual({ a: [1] });
  });

  it('refuses what the kit never writes, with the line', () => {
    const refused = ['a: &anchor 1\n', 'a: [1, 2]\n', 'a: >\n  folded\n', 'a:\n', 'a: 1\n b: 2\n', '- 1\na: 2\n'];

    for (const text of refused) {
      expect(() => fromYaml(text), text).toThrow(YamlShapeError);
    }

    expect(() => fromYaml('a: 1\nb: *x\n')).toThrow('line 2');
    expect(() => fromYaml('a: "unterminated\n')).toThrow(YamlShapeError);
    expect(() => fromYaml('a: .5e999\n')).toThrow(YamlShapeError);
  });
});
