import type { Actor } from '@ddd-ts-kit/kernel';
import type { FieldRequirement } from './field-requirement.js';

/** Whether the actor meets the requirement of a field, about this element: given to the adapters as `fieldAccess`. */
export type FieldDecider = (actor: Actor, requirement: FieldRequirement, subject: unknown) => Promise<boolean>;
