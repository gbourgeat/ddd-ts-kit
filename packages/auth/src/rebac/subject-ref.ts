import type { ResourceRef } from '../authorization/resource-ref.js';

export interface SubjectRef extends ResourceRef {
  /** Present for a userset. */
  readonly relation?: string;
}
