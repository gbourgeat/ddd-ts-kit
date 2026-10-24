import type { Schema } from '@ddd-ts-kit/validation';
import { payloadFields } from '../catalog/payload-fields';
import { InvalidEventDefinitionError } from './invalid-event-definition-error';
import type { PersonalPayload } from './personal-payload';

/**
 * Refuses a declaration of personal fields that names nothing, names a field twice, names its
 * subject as personal data or, when the schema documents its fields, names a field the payload
 * does not have: a declaration that lies is worse than none.
 */
export function assertPersonalPayload(type: string, payload: Schema<unknown>, personal: PersonalPayload): void {
  const { subject, fields } = personal;

  if (fields.length === 0) {
    throw new InvalidEventDefinitionError(`The personal fields of ${type} name no field`);
  }

  if (new Set(fields).size !== fields.length) {
    throw new InvalidEventDefinitionError(`The personal fields of ${type} list a field twice`);
  }

  if (fields.includes(subject)) {
    throw new InvalidEventDefinitionError(
      `The personal fields of ${type} name their subject "${subject}" as personal data: a data subject is an opaque identifier`,
    );
  }

  const documented = payloadFields(payload.toJsonSchema()).map((field) => field.path);
  const unknown = [subject, ...fields].filter((path) => !documented.includes(path));

  if (documented.length > 0 && unknown.length > 0) {
    throw new InvalidEventDefinitionError(
      `The personal fields of ${type} name ${unknown.map((path) => `"${path}"`).join(', ')}, which the payload does not have`,
    );
  }
}
