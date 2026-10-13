import type { FieldQuestion } from './field-question.js';

/** Whether the actor meets the requirement of a field, about this element: given to the adapters as `fieldAccess`. */
export type FieldDecider = (question: FieldQuestion) => Promise<boolean>;
