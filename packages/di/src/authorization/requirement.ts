import type { UseCaseDeclaration } from './use-case-declaration.js';

/** What a use case asks of whoever reaches it. Empty when nothing was declared. */
export type Requirement = Pick<UseCaseDeclaration, 'access' | 'permission' | 'resourceOf' | 'contextOf'>;

export const PUBLIC_REQUIREMENT: Requirement = { access: 'public' };
