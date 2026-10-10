import { schemaNameOf } from '../../../../../src/index.js';

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const BILLING = schemaNameOf('billing-core');
