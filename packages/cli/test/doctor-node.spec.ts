import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { inRange } from '../src/doctor/in-range.js';
import { nodeFindings } from '../src/doctor/node-findings.js';
import { cli, read, tempDir, write } from './helpers.js';
import { installKit } from './support/install-kit.js';
import { jsonAt } from './support/json-at.js';

describe('the range of engines.node and .nvmrc', () => {
  it.each([
    ['22.12.0', '>=22.12.0', true],
    ['22.11.9', '>=22.12.0', false],
    ['20.19.0', '^20.19.0 || >=22.12.0', true],
    ['21.0.0', '^20.19.0 || >=22.12.0', false],
    ['22.3.1', '22', true],
    ['23.0.0', '22', false],
    ['22.12.4', '22.12', true],
    ['22.13.0', '22.12', false],
    ['22.12.0', 'v22.12.0', true],
    ['22.12.1', '=22.12.0', false],
    ['20.5.0', '20.x', true],
    ['19.9.9', '18 - 20', true],
    ['21.0.0', '18 - 20', false],
    ['22.9.0', '~22.8', false],
    ['0.3.9', '^0.3.1', true],
    ['0.4.0', '^0.3.1', false],
    ['22.0.0', '>= 20 < 23', true],
    ['23.0.0', '>20 <=22', false],
    ['25.1.0', '*', true],
    ['22.12.1', '>22.12.0', true],
    ['22.12.0', '>22.12.0', false],
    ['22.13.0', '>22.12', true],
    ['22.12.9', '>22.12', false],
    ['22.12.9', '~22.12.3', true],
    ['22.13.0', '~22.12.3', false],
    ['22.9.0', '~22', true],
    ['0.2.5', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.0.9', '^0.0', true],
    ['0.1.0', '^0.0', false],
  ])('reads %s as in %s: %s', (version, range, inside) => {
    expect(inRange(version, range)).toBe(inside);
  });

  it('judges nothing it cannot read', () => {
    expect(inRange('22.12.0', 'lts/*')).toBeUndefined();
    expect(inRange('22.12.0', '>=22 || lts/jod')).toBeUndefined();
    expect(inRange('twenty-two', '>=22')).toBeUndefined();
  });
});

describe('the Node of a checkout', () => {
  it('says a running Node outside engines.node unsupported, and one .nvmrc does not name another version', () => {
    expect(nodeFindings('20.11.0', '>=22.12.0', '22\n')).toEqual([
      { area: 'node', name: 'engines.node', problem: 'unsupported', expected: '>=22.12.0', found: '20.11.0' },
      { area: 'node', name: '.nvmrc', problem: 'other version', expected: '22', found: '20.11.0' },
    ]);
  });

  it('accepts a Node the project asks, and leaves an alias of .nvmrc and a missing engines.node unjudged', () => {
    expect(nodeFindings('22.12.0', '>=22.12.0', 'v22.12')).toEqual([]);
    expect(nodeFindings('20.11.0', undefined, 'lts/*')).toEqual([]);
  });
});

describe('doctor, on the Node of the checkout', () => {
  let root: string;

  beforeEach(() => {
    root = path.join(tempDir('doctor-node'), 'shop');
    cli(root, 'init', '--context', 'billing:core', '--package-manager', 'npm');
    installKit(root);
  });

  it('fails --strict on a Node engines.node refuses, and names the fix', () => {
    write(root, 'package.json', read(root, 'package.json').replace('">=22.12.0"', '">=99.0.0"'));

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(`  node engines.node: unsupported (>=99.0.0; yours: ${process.versions.node})`);
    expect(result.stdout).toContain('fix: run the project with a Node that engines.node accepts');
  });

  it('says a Node .nvmrc does not name without failing --strict while engines.node accepts it', () => {
    write(root, '.nvmrc', '10\n');

    const result = cli(root, 'doctor', '--strict', '--json');

    expect(result.code).toBe(0);

    expect(jsonAt(result.json(), 'findings')).toEqual([
      { area: 'node', name: '.nvmrc', problem: 'other version', expected: '10', found: process.versions.node },
    ]);

    expect(cli(root, 'doctor').stdout).toContain('fix: `nvm use` switches to the Node .nvmrc names.');
  });
});
