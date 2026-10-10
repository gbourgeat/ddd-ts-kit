import type { Ok } from './result.js';

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
