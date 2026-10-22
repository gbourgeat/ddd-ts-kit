import type { Buildable } from './buildable';

/** The defaults of a builder: every required property has one, declared once. */
export type Defaults<Props> = { readonly [K in keyof Props]: Buildable<Props[K]> };
