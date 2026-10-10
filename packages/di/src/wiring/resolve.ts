import type { Token } from '@ddd-ts-kit/kernel/declarations';

export type Resolve = <T>(token: Token<T>) => T;
