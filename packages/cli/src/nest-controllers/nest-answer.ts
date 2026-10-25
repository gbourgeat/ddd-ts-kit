import type { NestReadType } from './nest-read-type';

/** What a method of a Nest controller answers, as its signature says it. */
export type NestAnswer = { readonly kind: 'none' } | { readonly kind: 'accepted' } | NestReadType;
