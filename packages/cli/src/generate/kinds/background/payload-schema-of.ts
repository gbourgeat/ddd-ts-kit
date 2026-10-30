import type { Scope } from '../../scope';
import { classPayloadSchema } from './class-payload-schema';
import { objectPayloadSchema } from './object-payload-schema';
import type { PayloadOf } from './payload-of';
import type { PayloadSchema } from './payload-schema';
import { writtenPayloadSchema } from './written-payload-schema';

/**
 * Written as a command body is: zod and TypeBox describe an object, class-validator decorates
 * the fields of a class, and a Standard Schema or a project without a validation library checks
 * each field by hand. The type of the payload follows from the schema, so the two never drift.
 */
export function payloadSchemaOf(scope: Scope, payload: PayloadOf): PayloadSchema {
  const { validation } = scope.config.stack;

  switch (validation) {
    case 'zod':
    case 'typebox':
      return objectPayloadSchema(validation, payload);
    case 'class-validator':
      return classPayloadSchema(payload);
    default:
      return writtenPayloadSchema(validation === 'standard-schema' ? 'standard-schema' : 'kernel', payload);
  }
}
