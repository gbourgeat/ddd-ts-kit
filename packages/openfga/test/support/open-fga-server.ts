import { OpenFgaClient } from '@openfga/sdk';
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { ensureAuthorizationModel, type OpenFgaApi } from '../../src';
import { openFgaClient } from '../../src/sdk';

/** The OpenFGA server of the integration job (`openfga/openfga`, pinned by digest); unset, the specs on a server are skipped. */
export const OPENFGA_URL = process.env['DDD_TS_KIT_OPENFGA_URL'] ?? '';

let created = 0;

/** A store of its own on the server, holding the model of the schema: one per test, so no test sees another's tuples. */
export async function freshStore(schema: Schema): Promise<OpenFgaApi> {
  const admin = new OpenFgaClient({ apiUrl: OPENFGA_URL });
  const { id: storeId } = await admin.createStore({ name: `ddd-ts-kit-${process.pid}-${(created += 1)}` });
  const client = openFgaClient({ apiUrl: OPENFGA_URL, storeId });

  await ensureAuthorizationModel(client, schema);

  return client;
}
