import type { Ok } from './result';

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
