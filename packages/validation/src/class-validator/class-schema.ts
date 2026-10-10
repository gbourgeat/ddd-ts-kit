import 'reflect-metadata';
import { plainToInstance, type ClassTransformOptions } from 'class-transformer';
import {
  validateSync,
  type ValidationError as ClassValidatorError,
  type ValidatorOptions,
} from 'class-validator';
import { err, ok } from '@ddd-ts-kit/kernel';
import type { Schema } from '../schema.js';
import type { ValidationIssue } from '../validation-issue.js';
import type { DtoClass } from './dto-class.js';
import { selfContainedSchema } from './self-contained-schema.js';

export interface ClassSchemaOptions {
  /** Merged over the defaults `{ whitelist: true, forbidNonWhitelisted: true }`. */
  readonly validator?: ValidatorOptions;
  readonly transform?: ClassTransformOptions;
}

export function classSchema<T extends object>(
  dto: DtoClass<T>,
  options: ClassSchemaOptions = {},
): Schema<T> {
  const validatorOptions: ValidatorOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
    ...options.validator,
  };

  return {
    parse(input) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return err([{ path: '', code: 'isObject', message: 'An object is expected.' }]);
      }

      const instance = plainToInstance(dto, input, options.transform);
      const errors = validateSync(instance, validatorOptions);

      return errors.length === 0 ? ok(instance) : err(flatten(errors, ''));
    },
    toJsonSchema: () => selfContainedSchema(dto.name),
  };
}

function flatten(errors: readonly ClassValidatorError[], parent: string): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parent === '' ? error.property : `${parent}.${error.property}`;

    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      path,
      code,
      message,
    }));

    return [...own, ...flatten(error.children ?? [], path)];
  });
}
