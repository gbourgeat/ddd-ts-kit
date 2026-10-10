import type { JsonSchema } from '@ddd-ts-kit/validation';
import { isRecord } from './is-record.js';

export function asSchema(node: unknown): JsonSchema {
  return isRecord(node) ? node : {};
}
