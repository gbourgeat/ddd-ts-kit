import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

describe.each(['tsyringe', 'inversify', 'awilix'])('a gateway in the explicit style on %s', (di) => {
  it('says where its contract is bound and what to bind there', () => {
    const root = tempDir('gateway-note');

    cli(root, 'init', '--di', di, '--style', 'explicit', '--context', 'billing:core');
    cli(
      root,
      'generate',
      'context',
      'shipping',
      '--classification',
      'supporting',
      '--upstream',
      'billing:customer-supplier',
    );

    const made = cli(root, 'generate', 'gateway', 'shipping', 'billing', 'InvoiceStatus');

    expect(made.code, made.stderr).toBe(0);
    expect(`${made.stdout}${made.stderr}`).toContain(
      'InvoiceStatusContract is bound to an empty value in shipping.module.ts: bind the implementation',
    );
  });
});
