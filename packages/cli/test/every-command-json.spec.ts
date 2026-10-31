import { beforeAll, describe, expect, it } from 'vitest';
import { COMMANDS } from '../src/run';
import { cli } from './helpers';
import { initProject } from './support/init-project';

let root: string;

beforeAll(() => {
  root = initProject();
});

/** `--help` says every command accepts --json: whatever it answers, a refusal included, is one line of JSON. */
describe('--json on every command of the table', () => {
  it.each(Object.keys(COMMANDS))(
    '%s answers on one line of JSON',
    (name) => {
      const result = cli(root, name, '--json');
      const printed = result.stdout.trim();

      expect(printed, `${name} printed nothing on stdout (stderr: ${result.stderr})`).not.toBe('');
      expect(printed.split('\n'), `${name} printed more than one line`).toHaveLength(1);
      expect(() => JSON.parse(printed), `${name} printed ${printed.slice(0, 80)}`).not.toThrow();
    },
    120_000,
  );
});
