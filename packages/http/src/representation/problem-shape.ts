import { PROBLEM_SCHEMA } from '../openapi/problem-schema.js';
import type { BodyShape } from './body-shape.js';

/** A refusal in any representation: the problem of RFC 9457, whose XML form is `<problem xmlns="urn:ietf:rfc:7807">`. */
export const PROBLEM_SHAPE: BodyShape = {
  schema: { ...PROBLEM_SCHEMA, xml: { name: 'problem', namespace: 'urn:ietf:rfc:7807' } },
  name: 'problem',
};
