import { expect } from 'vitest';
import { cli, type CliResult } from '../helpers';
import { initProject } from './init-project';

const PERSONAL = ['--personal', 'customer_email,customer_name'];

function ok(result: CliResult): CliResult {
  expect(result.code, result.stderr).toBe(0);

  return result;
}

/** A project of the given stack with a billing context, its Invoice aggregate and a repository that declares what the invoices keep of a customer. */
export function billingWithPersonalInvoices(flags: readonly string[], personal: readonly string[] = PERSONAL): string {
  const root = initProject(...flags);

  ok(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--purpose',
      'Bills customers for what they bought.',
      '--term',
      'Invoice=A request for payment sent to a customer',
      '--term',
      'Customer=A person who is billed',
    ),
  );

  ok(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));
  ok(cli(root, 'generate', 'repository', 'billing', 'Invoice', ...personal));

  return root;
}
