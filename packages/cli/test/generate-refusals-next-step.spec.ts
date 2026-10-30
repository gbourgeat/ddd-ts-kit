import { beforeAll, describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { failure } from './reports';
import { explicitProject } from './support/explicit-project';

describe('generate, the next step of a refusal', () => {
  let root: string;

  beforeAll(() => {
    root = explicitProject('generate-next-step');
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);
  });

  it('refuses a gateway to a context that already depends on this one, instead of declaring the cycle', () => {
    expect(
      cli(
        root,
        'generate',
        'context',
        'returns',
        '--classification',
        'supporting',
        '--upstream',
        'billing:customer-supplier',
      ).code,
    ).toBe(0);

    const result = cli(root, 'generate', 'gateway', 'billing', 'returns', 'Refund', '--json');

    expect(result.code).toBe(2);
    expect(failure(result).message).toContain('"returns" already has "billing" as an upstream');
    expect(failure(result).message).toContain('billing -> returns -> billing (context/no-cycle)');
    expect(failure(result).fix).not.toContain('upstreams');
  });

  it('still tells to declare an upstream that is not declared and closes no cycle', () => {
    expect(cli(root, 'generate', 'context', 'archive', '--classification', 'generic').code).toBe(0);

    const result = cli(root, 'generate', 'gateway', 'billing', 'archive', 'Refund', '--json');

    expect(result.code).toBe(2);
    expect(failure(result).message).toContain('does not declare "archive" as an upstream');
  });

  it('gives the whole command that creates the use case a route calls, permission included', () => {
    const result = cli(root, 'generate', 'route', 'billing', 'Ghost', '--method', 'POST', '--path', '/g', '--json');

    expect(result.code).toBe(2);

    expect(failure(result).fix).toContain(
      'ddd-ts-kit generate command billing Ghost (--permission <aggregate>.<action> | --public)',
    );
  });
});
