import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists } from './helpers.js';
import { failure } from './reports.js';
import { initProject } from './support/init-project.js';

const FIX_METHOD = 'Pass --method with one of: GET, POST, PUT, PATCH, DELETE.';
const FIX_PATH = 'Pass --path made of literal segments and ":name" parameters, for example /invoices/:invoiceId.';

describe('the endpoint of a generated route', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core');

    const query = cli(
      root,
      'generate',
      'query',
      'billing',
      'GetInvoice',
      '--permission',
      'invoice.get',
      '--allow-name',
    );

    expect(query.code, query.stderr).toBe(0);
  });

  function route(...flags: readonly string[]) {
    return cli(root, 'generate', 'route', 'billing', 'GetInvoice', ...flags, '--json');
  }

  it('is refused without a method, or with a method HTTP routes do not take', () => {
    expect(failure(route('--path', '/invoices'))).toEqual({ message: 'A route needs --method.', fix: FIX_METHOD });

    expect(failure(route('--method', 'FETCH', '--path', '/invoices'))).toEqual({
      message: 'Unknown method "FETCH".',
      fix: FIX_METHOD,
    });
  });

  it('is refused without a path, or with a path that does not start at the root', () => {
    expect(failure(route('--method', 'get'))).toEqual({ message: 'A route needs --path.', fix: FIX_PATH });

    expect(failure(route('--method', 'get', '--path', 'invoices/:invoiceId'))).toEqual({
      message: '"invoices/:invoiceId" is not a valid route path.',
      fix: FIX_PATH,
    });

    expect(exists(root, 'src/contexts/billing/presentation/http/invoices/get-invoice')).toBe(false);
  });

  it('takes a method written in lower case and the parameters of its path', () => {
    const generated = route('--method', 'get', '--path', '/invoices/:invoiceId');

    expect(generated.code, generated.stdout).toBe(0);
    expect(cli(root, 'describe', 'billing', '--json').stdout).toContain('/invoices/:invoiceId');
  });
});
