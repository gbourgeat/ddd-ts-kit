import type { Err } from './result';

export const err = <E>(error: E): Err<E> => ({ ok: false, error });
