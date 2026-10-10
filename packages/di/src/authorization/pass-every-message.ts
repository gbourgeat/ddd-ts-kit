import type { UseCaseGuard } from './use-case-guard.js';

export const passEveryMessage: UseCaseGuard = { check: (_message, next) => next() };
