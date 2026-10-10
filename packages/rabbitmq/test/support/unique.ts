import { randomUUID } from 'node:crypto';

export const unique = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;
