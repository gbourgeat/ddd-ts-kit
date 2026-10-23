import type { UseCaseGuard } from './use-case-guard';

export const passEveryMessage: UseCaseGuard = { check: (_message, next) => next() };
