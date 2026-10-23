import type { ResourceRef } from '../authorization/resource-ref';
import { InvalidTupleError } from './invalid-tuple-error';

const OBJECT_PATTERN = /^([a-z][a-z0-9_-]*):([^#@\s]+)$/;

export function parseObject(object: string): ResourceRef {
  const [, type, id] = OBJECT_PATTERN.exec(object) ?? [];

  if (type === undefined || id === undefined) {
    throw new InvalidTupleError(`"${object}" is not an object: expected <type>:<id>.`);
  }

  return { type, id };
}
