import 'reflect-metadata';
import { plainToInstance, type ClassTransformOptions } from 'class-transformer';
import { validateSync, type ValidationError as ClassValidatorError, type ValidatorOptions } from 'class-validator';
import { err, ok } from '@ddd-ts-kit/kernel';
import type { Schema } from '../schema';
import type { ValidationIssue } from '../validation-issue';
import type { DtoClass } from './dto-class';
import { assertNoInitialValue } from './assert-no-initial-value';
import { selfContainedSchema } from './self-contained-schema';

export interface ClassSchemaOptions {
  /** Merged over the defaults `{ whitelist: true, forbidNonWhitelisted: true }`. */
  readonly validator?: ValidatorOptions;
  readonly transform?: ClassTransformOptions;
  /**
   * Documented once, under the name of the class: the contract holds it in `components.schemas`
   * and every route that uses it refers to it, as it already does for a nested class.
   */
  readonly shared?: boolean;
}

/**
 * Validates with the decorators of a class. A class one of whose fields has an initial value is
 * refused here, at construction (`DeclarationError`): that value would stand in for a field the
 * input lacks.
 */
export function classSchema<T extends object>(dto: DtoClass<T>, options: ClassSchemaOptions = {}): Schema<T> {
  assertNoInitialValue(dto);

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
    toJsonSchema: () => selfContainedSchema(dto, options.shared === true),
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
