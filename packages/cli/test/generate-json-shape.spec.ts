import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

let root: string;

beforeAll(() => {
  root = tempDir('json-shape');

  expect(cli(root, 'init', '--context', 'ordering:core').code).toBe(0);
});

describe('generate --json, the shape a script reads', () => {
  it('says the directory every path shares once, as root, each path from it, and leaves out the lists that hold nothing and a dry run that is not one', () => {
    const json = cli(root, 'generate', 'port', 'ordering', 'PaymentGateway', '--json').json();

    expect(json).toEqual({
      root: 'src/contexts/ordering/',
      created: ['application/ports/payment-gateway.port.ts', 'test/fakes/payment-gateway.fake.ts'],
      updated: ['CONTEXT.md'],
      todos: [
        expect.objectContaining({ file: 'application/ports/payment-gateway.port.ts', line: 2 }),
        expect.objectContaining({ file: 'test/fakes/payment-gateway.fake.ts', line: 4 }),
      ],
      notes: [expect.stringContaining('PaymentGateway has no adapter yet')],
    });
  });

  it('prints every path whole when one sits outside the directory of the others', () => {
    const json = cli(root, 'generate', 'aggregate', 'ordering', 'Order', '--term', 'Order=A purchase', '--json').json();

    expect(json).not.toHaveProperty('root');
    expect(json).toMatchObject({ updated: expect.arrayContaining(['src/contexts/ordering/CONTEXT.md']) });
  });

  it('says a dry run, and prints no root when a path sits at the root of the project', () => {
    const json = cli(tempDir('json-shape-init'), 'init', '--dry-run', '--json').json() as Record<string, unknown>;

    expect(json).toMatchObject({ dryRun: true, created: expect.arrayContaining(['package.json']) });
    expect(json).not.toHaveProperty('root');
    expect(json).not.toHaveProperty('deleted');
  });
});
