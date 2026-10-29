import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';
import { initProject } from './support/init-project';

const notAName = (input: string, what: string, read: string): string =>
  `error: \`${input}\` is not a name: a ${what} is named in letters, digits and dashes, and the kit would have read \`${read}\` in it.`;

describe('a name the kit would have to rewrite to read', () => {
  let root: string;
  let config: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core', '--audit', 'off');
    config = read(root, 'ddd-ts-kit.config.json');
  });

  it.each([
    ['../evil', 'evil'],
    ['Évil', 'vil'],
  ])('is refused as the name of a new context, %s, before anything is written', (input, kept) => {
    const refused = cli(root, 'generate', 'context', input, '--classification', 'core');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(notAName(input, 'context', kept));
    expect(exists(root, `src/contexts/${kept}`)).toBe(false);
    expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
  });

  it('is refused as the context a generator works in, which it would otherwise have found', () => {
    const refused = cli(root, 'generate', 'aggregate', '../billing', 'Invoice');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(notAName('../billing', 'context', 'billing'));
    expect(refused.stderr).toContain('fix: Name a context as the config declares it: billing.');
    expect(exists(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts')).toBe(false);
  });

  it('is refused as an upstream, a module, and the context of the commands that move files', () => {
    const refusals = [
      [
        cli(root, 'generate', 'context', 'shipping', '--classification', 'core', '--upstream', '../billing'),
        notAName('../billing', 'context', 'billing'),
      ],
      [cli(root, 'generate', 'module', 'billing', '../payments'), notAName('../payments', 'module', 'payments')],
      [
        cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--module', '../payments'),
        notAName('../payments', 'module', 'payments'),
      ],
      [
        cli(root, 'generate', 'route-group', 'billing', 'Invoices', '--group', '../BillingRoutes'),
        notAName('../BillingRoutes', 'route group', 'billing-routes'),
      ],
      [cli(root, 'move-to-module', '../billing', 'payments', 'a.ts'), notAName('../billing', 'context', 'billing')],
      [cli(root, 'context-layout', '../billing'), notAName('../billing', 'context', 'billing')],
    ] as const;

    for (const [refused, message] of refusals) {
      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(message);
    }

    expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
  });

  it('is refused by init --context', () => {
    const refused = cli(tempDir('init'), 'init', '--context', '../evil:core', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(notAName('../evil', 'context', 'evil'));
  });

  it('is read when only its case or its separators change', () => {
    const planned = cli(root, 'generate', 'context', 'Order_Fulfilment', '--classification', 'core', '--dry-run');

    expect(planned.code).toBe(0);
    expect(planned.stdout).toContain('src/contexts/order-fulfilment/CONTEXT.md');
  });
});
