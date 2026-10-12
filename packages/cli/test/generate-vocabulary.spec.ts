import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers.js';
import { failure } from './reports.js';

const STATUS = 'src/contexts/billing/domain/vocabularies/invoice-status.vocabulary.ts';

describe('generate vocabulary', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('vocabulary');
    expect(cli(root, 'init', '--authz', 'rbac').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
  });

  it('writes the values as an object `as const` and the union type of the same name', () => {
    const values = ['--value', 'draft', '--value', 'issued', '--value', 'paid-late'];

    expect(cli(root, 'generate', 'vocabulary', 'billing', 'InvoiceStatus', ...values).code).toBe(0);

    expect(read(root, STATUS)).toBe(
      [
        'export const InvoiceStatus = {',
        "  Draft: 'draft',",
        "  Issued: 'issued',",
        "  PaidLate: 'paid-late',",
        '} as const;',
        '',
        'export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];',
        '',
      ].join('\n'),
    );
  });

  it('adds the values the file does not hold yet, and keeps the others', () => {
    expect(
      cli(root, 'generate', 'vocabulary', 'billing', 'InvoiceStatus', '--value', 'issued', '--value', 'void').code,
    ).toBe(0);

    expect(read(root, STATUS)).toContain("  PaidLate: 'paid-late',\n  Void: 'void',\n} as const;");
    expect(read(root, STATUS).match(/Issued:/g)).toHaveLength(1);
  });

  it('refuses a vocabulary without a value, a value that cannot be a key, and two values under one key', () => {
    expect(failure(cli(root, 'generate', 'vocabulary', 'billing', 'Channel', '--json')).fix).toContain('--value');

    expect(
      failure(cli(root, 'generate', 'vocabulary', 'billing', 'Channel', '--value', "o'clock", '--json')).message,
    ).toContain('cannot be a value');

    expect(
      failure(
        cli(root, 'generate', 'vocabulary', 'billing', 'Channel', '--value', 'e-mail', '--value', 'e mail', '--json'),
      ).message,
    ).toContain('EMail');

    expect(exists(root, 'src/contexts/billing/domain/vocabularies/channel.vocabulary.ts')).toBe(false);
  });

  it('gives a new project its roles as a vocabulary, read by the grants and by the guard of a route group', () => {
    expect(read(root, 'src/platform/auth/role.ts')).toContain(
      "export const Role = {\n  Admin: 'admin',\n  System: 'system',\n} as const;",
    );

    expect(read(root, 'src/platform/auth/roles.ts')).toContain('[Role.Admin]: [');
    expect(read(root, 'src/platform/auth/create-authorizer.ts')).toContain('systemRole: Role.System');

    expect(
      cli(root, 'generate', 'route-group', 'billing', 'Ledger', '--prefix', '/ledger', '--role', 'accountant').code,
    ).toBe(0);

    expect(read(root, 'src/contexts/billing/presentation/http/ledger.routes.ts')).toContain(
      'guards: [HasRole(Role.Accountant)]',
    );

    expect(read(root, 'src/platform/auth/role.ts')).toContain(
      "  System: 'system',\n  Accountant: 'accountant',\n} as const;",
    );
  });
});
