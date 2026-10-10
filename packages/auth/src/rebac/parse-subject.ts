import { InvalidTupleError } from './invalid-tuple-error.js';
import { parseObject } from './parse-object.js';
import type { SubjectRef } from './subject-ref.js';

const NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

export function parseSubject(subject: string): SubjectRef {
  const [object = '', relation, ...rest] = subject.split('#');

  if (rest.length > 0 || (relation !== undefined && !NAME_PATTERN.test(relation))) {
    throw new InvalidTupleError(`"${subject}" is not a subject: expected <type>:<id> or <type>:<id>#<relation>.`);
  }

  return relation === undefined ? parseObject(object) : { ...parseObject(object), relation };
}
