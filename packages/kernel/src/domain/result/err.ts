import type { Err } from './result.js';

export const err = <E>(error: E): Err<E> => ({ ok: false, error });
