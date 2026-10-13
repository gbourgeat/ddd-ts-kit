import type { FieldPolicy } from './field-policy.js';

/**
 * What an actor needs to see or set a field: a permission, decided by the `Access` of the
 * application as for a use case (a `Permission` of `@ddd-ts-kit/auth` is one), or a policy.
 */
export type FieldRequirement = { readonly permission: { readonly id: string } } | { readonly policy: FieldPolicy };
