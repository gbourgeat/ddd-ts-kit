import 'reflect-metadata';
import { TransformationType, type TypeMetadata } from 'class-transformer';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage.js';
import { getMetadataStorage } from 'class-validator';
import type { DtoClass } from './dto-class.js';
import { prototypeOf } from './prototype-of.js';

const TRANSFORMATIONS = [
  TransformationType.PLAIN_TO_CLASS,
  TransformationType.CLASS_TO_PLAIN,
  TransformationType.CLASS_TO_CLASS,
];

/**
 * Copies onto `target` what class-validator and class-transformer know of each property of
 * `source`, its ancestors included, that `keeps` accepts: the constraints, the nested type, the
 * transformations and the reflected type. Answers the properties copied.
 */
export function copyClassMetadata(
  source: DtoClass<object>,
  target: DtoClass<object>,
  keeps: (property: string) => boolean,
): string[] {
  const storage = getMetadataStorage();
  const copied = new Set<string>();

  for (const metadata of storage.getTargetValidationMetadatas(source, '', true, false)) {
    if (keeps(metadata.propertyName)) {
      storage.addValidationMetadata(Object.assign({}, metadata, { target }));
      copied.add(metadata.propertyName);
    }
  }

  for (const property of copied) {
    copyTransformations(source, target, property);
    copyReflectedType(source, target, property);
  }

  return [...copied];
}

function copyTransformations(source: DtoClass<object>, target: DtoClass<object>, property: string): void {
  const type = typeMetadataOf(source, property);

  if (type !== undefined) {
    defaultMetadataStorage.addTypeMetadata({ ...type, target });
  }

  for (const transformation of TRANSFORMATIONS) {
    for (const transform of defaultMetadataStorage.findTransformMetadatas(source, property, transformation)) {
      defaultMetadataStorage.addTransformMetadata({ ...transform, target });
    }
  }
}

/** class-transformer answers `undefined` for a property without `@Type`, which its declaration does not say. */
function typeMetadataOf(source: DtoClass<object>, property: string): TypeMetadata | undefined {
  return defaultMetadataStorage.findTypeMetadata(source, property);
}

function copyReflectedType(source: DtoClass<object>, target: DtoClass<object>, property: string): void {
  const reflected: unknown = Reflect.getMetadata('design:type', prototypeOf(source), property);

  if (reflected !== undefined) {
    Reflect.defineMetadata('design:type', reflected, prototypeOf(target), property);
  }
}
