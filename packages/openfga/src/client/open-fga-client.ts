import { CredentialsMethod, OpenFgaClient } from '@openfga/sdk';
import type { OpenFgaApi } from './open-fga-api';
import type { OpenFgaClientOptions } from './open-fga-client-options';

/** The client of the official SDK, bound to one store, as the adapters of this package take it. */
export function openFgaClient({ apiUrl, storeId, authorizationModelId, apiToken }: OpenFgaClientOptions): OpenFgaApi {
  return new OpenFgaClient({
    apiUrl,
    storeId,
    ...(authorizationModelId === undefined ? {} : { authorizationModelId }),
    ...(apiToken === undefined
      ? {}
      : { credentials: { method: CredentialsMethod.ApiToken, config: { token: apiToken } } }),
  });
}
