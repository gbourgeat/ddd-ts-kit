import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import type { FieldAccessEntry } from './field-access-entry.js';
import { fieldAccess } from './field-access.js';
import type { FieldRequirement } from './field-requirement.js';
import type { FieldRule } from './field-rule.js';
import type { FieldRules } from './field-rules.js';

/**
 * The same schema, with fields reserved to some callers:
 *
 *     const answer = withFieldAccess(classSchema(GetAppointmentAnswer), {
 *       internalNote: { read: { permission: notes.read }, write: { policy: notesOfTheirOwnPatients } },
 *     });
 *
 * In an answer, a field the actor may not read is left out, in every representation; in a request
 * body, a field the actor may not set is refused with 403; in a form, the first is absent and the
 * second read-only. The contract marks each one with `x-field-access` and no longer lists it as
 * required, since a caller may not receive it. Validation is the schema's own, unchanged.
 */
export function withFieldAccess<T>(schema: Schema<T>, rules: FieldRules<T>): Schema<T> {
  const entries: FieldAccessEntry[] = Object.entries<FieldRule<T> | undefined>(rules).flatMap(([name, rule]) =>
    rule === undefined ? [] : [{ path: [name], rule }],
  );

  const restricted: Schema<T> = {
    parse: (input) => schema.parse(input),
    toJsonSchema: () => annotated(schema.toJsonSchema(), entries),
  };

  fieldAccess.mark(restricted, entries);

  return restricted;
}

function annotated(schema: JsonSchema, entries: readonly FieldAccessEntry[]): JsonSchema {
  const { properties, required } = schema;
  const names = new Set(entries.flatMap(({ path }) => path));

  if (!isRecord(properties)) {
    return schema;
  }

  const marked = Object.fromEntries(
    Object.entries(properties).map(([name, property]) => {
      const rule = entries.find(({ path }) => path[0] === name)?.rule;

      return [
        name,
        rule === undefined || !isRecord(property) ? property : { ...property, 'x-field-access': described(rule) },
      ];
    }),
  );

  const stillRequired = Array.isArray(required)
    ? required.filter((name) => typeof name !== 'string' || !names.has(name))
    : undefined;

  return { ...schema, properties: marked, ...(stillRequired === undefined ? {} : { required: stillRequired }) };
}

function described(rule: FieldRule): JsonSchema {
  return {
    ...(rule.read === undefined ? {} : { read: requirementOf(rule.read) }),
    ...(rule.write === undefined ? {} : { write: requirementOf(rule.write) }),
  };
}

function requirementOf(requirement: FieldRequirement): JsonSchema {
  return 'permission' in requirement ? { permission: requirement.permission.id } : { policy: requirement.policy.name };
}
