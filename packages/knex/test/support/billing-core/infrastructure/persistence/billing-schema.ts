import { schemaNameOf } from '../../../../../src';

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const BILLING = schemaNameOf('billing-core');
