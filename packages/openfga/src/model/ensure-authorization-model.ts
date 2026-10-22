import type { Schema } from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaApi } from '../client/open-fga-api';
import { authorizationModelOf } from './authorization-model-of';
import { modelDrift } from './model-drift';

/**
 * Makes the latest model of the store the one the schema generates, writing a new one only when
 * they differ (OpenFGA keeps every model it was given; a check uses the latest unless told
 * otherwise). Answers the id of the model in force and what changed. For a deployment step or
 * the start of the application; a pipeline checks without writing, with `modelDrift`.
 */
export async function ensureAuthorizationModel(
  client: OpenFgaApi,
  schema: Schema,
): Promise<{ readonly modelId: string; readonly changes: readonly string[] }> {
  const expected = authorizationModelOf(schema);
  const { authorization_model: held } = await client.readLatestAuthorizationModel();
  const changes = modelDrift(expected, held);

  if (changes.length === 0) {
    return { modelId: String(Reflect.get(Object(held), 'id')), changes };
  }

  const { authorization_model_id: modelId } = await client.writeAuthorizationModel(expected);

  return { modelId, changes };
}
