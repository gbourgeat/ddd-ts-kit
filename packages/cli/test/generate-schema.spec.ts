import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const SHARED = 'src/contexts/billing/presentation/http/shared';

describe('generate schema', () => {
  it('declares a zod shape once in the shared folder of the presentation of its context, under an id of the contract', () => {
    const root = initProject('--context', 'billing:core');

    expect(cli(root, 'generate', 'schema', 'billing', 'BillingAddress').code).toBe(0);

    const schema = read(root, `${SHARED}/billing-address.schema.ts`);

    expect(schema).toContain("import { z } from 'zod';\n\nexport const billingAddressSchema = z");
    expect(schema).toContain(".meta({ id: 'BillingAddress' });");
  });

  it('declares a class-validator shape as a class named after the component', () => {
    const root = initProject('--validation', 'class-validator', '--context', 'billing:core');

    cli(root, 'generate', 'schema', 'billing', 'BillingAddressDto');

    expect(read(root, `${SHARED}/billing-address.schema.ts`)).toMatch(
      /^export class BillingAddress \{\n {2}\/\/ TODO\(domain\): [^\n]*classSchema\(BillingAddress, \{ shared: true \}\)/,
    );
  });

  it('declares a TypeBox shape under an $id of the contract', () => {
    const root = initProject('--validation', 'typebox', '--context', 'billing:core');

    cli(root, 'generate', 'schema', 'billing', 'BillingAddress');

    expect(read(root, `${SHARED}/billing-address.schema.ts`)).toContain(
      'export const billingAddressSchema = Type.Object(\n  {\n    // TODO(domain): ',
    );

    expect(read(root, `${SHARED}/billing-address.schema.ts`)).toContain("{ $id: 'BillingAddress' },");
  });

  it('writes in presentation/ of the shared kernel what several contexts answer with', () => {
    const root = initProject('--validation', 'standard-schema', '--context', 'billing:core');
    const result = cli(root, 'generate', 'schema', 'shared-kernel', 'Money', '--json');

    expect(result.code).toBe(0);
    expect(jsonAt(result.json(), 'created')).toEqual(['src/shared-kernel/presentation/money.schema.ts']);

    expect(read(root, 'src/shared-kernel/presentation/money.schema.ts')).toContain(
      "export const moneySchema = sharedSchema(\n  'Money',\n  customSchema<Record<string, unknown>>(",
    );
  });

  it('refuses an unknown context, and a run confined to a context that would write in the shared kernel', () => {
    const root = initProject('--context', 'billing:core');

    expect(cli(root, 'generate', 'schema', 'shipping', 'Parcel').stderr).toContain('Unknown context "shipping"');

    expect(cli(root, 'generate', 'schema', 'shared-kernel', 'Money', '--local-only').stderr).toContain(
      'src/shared-kernel/presentation/money.schema.ts',
    );
  });
});
