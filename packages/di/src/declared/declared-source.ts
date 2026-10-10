import type { DeclaredClass } from '@ddd-ts-kit/kernel/declarations';

/**
 * Classes that declare themselves: one class, a list (lists may nest), or a namespace import of
 * a barrel, of which only the declared classes are kept.
 */
export type DeclaredSource = DeclaredClass | readonly DeclaredSource[] | Readonly<Record<string, unknown>>;
