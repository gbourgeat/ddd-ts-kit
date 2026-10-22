import { err, ok, type Result } from '@ddd-ts-kit/kernel';
import { customSchema, sharedSchema, type Schema, type ValidationIssue } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record';
import type { Accepted } from './accepted';

/**
 * The body every command route answers with, shared by the platform: one `Accepted` component in
 * the contract, referenced by each route instead of a copy of `{ id }` per route.
 */
export const acceptedSchema: Schema<Accepted> = sharedSchema(
  'Accepted',
  customSchema(parseAccepted, {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'The identifier of what the command created or changed.' } },
    additionalProperties: false,
  }),
);

function parseAccepted(input: unknown): Result<Accepted, ValidationIssue[]> {
  if (isRecord(input) && typeof input['id'] === 'string') {
    return ok({ id: input['id'] });
  }

  return err([{ path: 'id', code: 'invalid_type', message: 'An identifier is expected.' }]);
}
