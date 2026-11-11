import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { expectOk } from './support/expect-ok';

const EMPTY = 'builder.bind(InvoiceStatusContract).toValue({});';
const WRITTEN = 'builder.bind(InvoiceStatusContract).toValue(invoiceStatusOfBilling);';

describe('a gateway on a contract another context already reads', () => {
  it('leaves the binding of the contract as a person wrote it, where the first gateway bound an empty value', () => {
    const root = tempDir('gateway-twice');

    expectOk(cli(root, 'init', '--context', 'billing:core'));

    for (const downstream of ['shipping', 'reporting']) {
      expectOk(
        cli(
          root,
          'generate',
          'context',
          downstream,
          '--classification',
          'supporting',
          '--upstream',
          'billing:customer-supplier',
        ),
      );
    }

    expectOk(cli(root, 'generate', 'gateway', 'shipping', 'billing', 'InvoiceStatus'));

    const bound = filesOf(path.join(root, 'src/platform')).filter((file) => read(root, file).includes(EMPTY));

    expect(bound.length).toBeGreaterThan(0);

    for (const file of bound) {
      write(root, file, read(root, file).replace(EMPTY, WRITTEN));
    }

    expectOk(cli(root, 'generate', 'gateway', 'reporting', 'billing', 'InvoiceStatus'));

    for (const file of bound) {
      expect(read(root, file)).toContain(WRITTEN);
      expect(read(root, file)).not.toContain(EMPTY);
    }
  });
});

function filesOf(directory: string): string[] {
  return fs
    .readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.posix.join('src/platform', file));
}
