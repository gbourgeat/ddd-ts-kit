import { z } from 'zod';
import { err, ok } from '@ddd-ts-kit/kernel';
import { formatPath, type JsonSchema, type Schema } from './index.js';

export interface ZodSchemaOptions {
  /**
   * Which side of the schema the JSON Schema describes. `input` (default) documents what a
   * client sends: fields with a default are optional. Use `output` for response bodies.
   */
  readonly io?: 'input' | 'output';
}

export function zodSchema<Z extends z.ZodType>(
  type: Z,
  options: ZodSchemaOptions = {},
): Schema<z.output<Z>> {
  return {
    parse(input) {
      const result = type.safeParse(input);
      if (result.success) {
        return ok(result.data);
      }
      return err(
        result.error.issues.map((issue) => ({
          path: formatPath(issue.path),
          code: issue.code,
          message: issue.message,
        })),
      );
    },
    toJsonSchema(): JsonSchema {
      return z.toJSONSchema(type, {
        target: 'draft-2020-12',
        io: options.io ?? 'input',
        // A contract generator must not crash on a Date or a bigint: they degrade to `{}`.
        unrepresentable: 'any',
      });
    },
  };
}
