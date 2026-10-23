import { describe, expect, it } from 'vitest';
import { stringifyContract } from '../src/contracts/stringify-contract';
import { toYaml } from '../src/yaml/to-yaml';
import { readYaml } from './support/read-yaml';
import { AWKWARD, MISREAD, SHAPES, TEXTS } from './support/yaml-samples';

describe('toYaml', () => {
  it('writes maps and lists in block style, two spaces per level, a map in a list after its dash', () => {
    expect(toYaml({ openapi: '3.1.0', tags: [{ name: 'audit', description: 'x' }], paths: {}, list: [] })).toBe(
      "openapi: '3.1.0'\ntags:\n  - name: audit\n    description: x\npaths: {}\nlist: []\n",
    );

    expect(toYaml([['a', 'b'], { c: [1] }])).toBe('- - a\n  - b\n- c:\n    - 1\n');
  });

  it('quotes what a reader would take for a boolean, a null, a number, a date or an indicator, and only that', () => {
    expect(toYaml(MISREAD)).toBe(`${MISREAD.map((text) => `- '${text}'`).join('\n')}\n`);

    expect(toYaml(['plain text', 'a:b', 'it is #1', "it's", 'a: b', '@x'])).toBe(
      "- plain text\n- a:b\n- 'it is #1'\n- it's\n- 'a: b'\n- '@x'\n",
    );

    expect(toYaml({ '200': 1, '': 2, 'a b': 3 })).toBe("'200': 1\n'': 2\na b: 3\n");
  });

  it('double-quotes a text only an escape can write', () => {
    expect(toYaml(['a\u0001b', 'a\u2028b', 'a\r\nb'])).toBe('- "a\\u0001b"\n- "a\\u2028b"\n- "a\\r\\nb"\n');
  });

  it('writes a text of several lines as a literal block, with the chomping that keeps its last line breaks', () => {
    expect(toYaml({ description: TEXTS.clipped, summary: TEXTS.stripped, kept: TEXTS.kept })).toBe(
      'description: |\n  line one\n  line two\nsummary: |-\n  a\n  b\nkept: |+\n  a\n\n',
    );

    expect(toYaml({ code: TEXTS.indentedFirst })).toBe('code: |2\n    indented\n  next\n');
  });

  it('is read back as the same value by YAML 1.2 and 1.1 readers', () => {
    const values = [AWKWARD, TEXTS, SHAPES, 'just text', 7];
    const read = readYaml(values.map((value) => toYaml(value)));

    for (const [index, back] of read.entries()) {
      expect(back.yaml12, `yaml 1.2, value ${index}`).toEqual(values[index]);
      expect(back.yaml11, `yaml 1.1, value ${index}`).toEqual(values[index]);
      expect(back.jsYaml, `js-yaml, value ${index}`).toEqual(values[index]);
    }
  });
});

describe('stringifyContract', () => {
  it('writes YAML unless the format is json, which is two-space JSON; both end with a line break', () => {
    expect(stringifyContract({ openapi: '3.1.0' }, 'yaml')).toBe("openapi: '3.1.0'\n");
    expect(stringifyContract({ openapi: '3.1.0' }, 'json')).toBe('{\n  "openapi": "3.1.0"\n}\n');
  });
});
