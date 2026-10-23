import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, walk } from './helpers';
import { report } from './reports';
import { explicitProject } from './support/explicit-project';

describe('generate adr', () => {
  let root: string;

  beforeAll(() => {
    root = explicitProject('adr');
  });

  it('takes the number after the highest when none is asked', () => {
    const first = report(cli(root, 'generate', 'adr', 'Keep one database per context', '--json'));
    const highest = Math.max(...walk(root, 'docs/adr').map((file) => Number(/\/(\d+)-/.exec(file)?.[1] ?? '0')));

    expect(first.created).toEqual([`docs/adr/${String(highest).padStart(4, '0')}-keep-one-database-per-context.md`]);
  });

  it('writes the number asked with --number in the file, the title and the deviation entry', () => {
    const asked = report(
      cli(
        root,
        'generate',
        'adr',
        'Allow a longer handler',
        '--number',
        '401',
        '--deviation',
        'rules.clean/function-size',
        '--reason',
        'One import script',
        '--json',
      ),
    );

    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { deviations: unknown[] };

    expect(asked.created).toEqual(['docs/adr/0401-allow-a-longer-handler.md']);
    expect(read(root, 'docs/adr/0401-allow-a-longer-handler.md')).toContain('# ADR-0401');

    expect(config.deviations).toContainEqual({
      what: 'rules.clean/function-size',
      adr: '0401',
      reason: 'One import script',
    });
  });

  it('keeps numbering after the highest once a block is taken', () => {
    const next = report(cli(root, 'generate', 'adr', 'Read the catalog without a gateway', '--json'));

    expect(next.created).toEqual(['docs/adr/0402-read-the-catalog-without-a-gateway.md']);
  });

  it('refuses a number already in docs/adr/, whatever its padding', () => {
    const refused = cli(root, 'generate', 'adr', 'Another decision', '--number', '0401');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('ADR-0401 already exists in docs/adr/');
    expect(refused.stderr).toContain('Pass a free number with --number');
  });

  it('refuses a number that is not a positive whole number', () => {
    for (const value of ['4a', '-3', '0', '1.5']) {
      const refused = cli(root, 'generate', 'adr', 'Another decision', `--number=${value}`);

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`--number ${value} is not the number of a decision record`);
    }
  });
});
