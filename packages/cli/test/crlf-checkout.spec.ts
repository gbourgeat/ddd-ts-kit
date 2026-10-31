import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, walk, write } from './helpers';
import { initProject } from './support/init-project';

let root: string;

/** What a clone with core.autocrlf=true holds: every text file with CRLF line ends. */
function convertToCrlf(directory: string): void {
  for (const file of walk(directory)) {
    const full = path.join(directory, file);

    fs.writeFileSync(full, fs.readFileSync(full, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
}

beforeAll(() => {
  root = initProject('--context', 'billing:core');

  expect(
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=a bill sent to a customer').code,
  ).toBe(0);

  expect(cli(root, 'check').code).toBe(0);
  expect(cli(root, 'docs').code).toBe(0);
  convertToCrlf(root);
});

describe('a checkout with CRLF line ends', () => {
  it('passes check on code nobody edited', () => {
    const result = cli(root, 'check');

    expect(result.stdout).toMatch(/^0 errors, 0 warnings/m);
    expect(result.code).toBe(0);
  });

  it('judges the braces of a body whatever the line end', () => {
    write(
      root,
      'src/contexts/billing/domain/services/x.ts',
      'export function x(a: number) {\r\n  if (a) { return 1; }\r\n\r\n  return 2;\r\n}\r\n',
    );

    const result = cli(root, 'check', '--rule', 'clean/braces', '--json');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('clean/braces');

    fs.rmSync(path.join(root, 'src/contexts/billing/domain/services/x.ts'));
  });

  it('finds the generated documents current, as the same checkout with LF', () => {
    const result = cli(root, 'docs', '--check');

    expect(result.stdout).toContain('up to date');
    expect(result.code).toBe(0);
  });

  it('writes a generated document that changed with LF, as every file the kit writes', () => {
    write(
      root,
      'docs/behaviour/README.md',
      read(root, 'docs/behaviour/README.md').replace(/\r\n/g, '\r\n') + 'a stale line\r\n',
    );

    expect(cli(root, 'docs', '--check').code).toBe(1);
    expect(cli(root, 'docs').code).toBe(0);

    const text = fs.readFileSync(path.join(root, 'docs/behaviour/README.md'), 'utf8');

    expect(text).not.toContain('a stale line');
    expect(text).not.toContain('\r');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });
});
