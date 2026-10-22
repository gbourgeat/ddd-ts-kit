import type { JsonSchema } from '@ddd-ts-kit/validation';
import { isRecord } from './is-record';

export function asSchema(node: unknown): JsonSchema {
  return isRecord(node) ? node : {};
}
