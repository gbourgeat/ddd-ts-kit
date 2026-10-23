import type { SdkConfig } from './config';
import { DEFAULT_SDK_NAME } from './default-sdk-name';
import { isRecord } from './values/is-record';
import { text } from './values/text';

/** Tolerant: a key that is not an object generates no client, a wrong access is kept as written, and `config/valid` reports both. */
export function parseSdk(value: unknown): SdkConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const access = value['access'];

  return { name: text(value['name'], DEFAULT_SDK_NAME), access: typeof access === 'string' ? access : undefined };
}
