import type { ContextConfig } from './config';
import { editConfigText } from './edit-config-text';
import { isRecord } from './values/is-record';

/**
 * Adds a context to the config text without reformatting what the user wrote
 * elsewhere (extra directories written as `{ path, reason }` keep their reason).
 */
export function addContextToConfigText(content: string, name: string, context: ContextConfig): string {
  return editConfigText(content, (raw) => {
    const contexts = isRecord(raw['contexts']) ? raw['contexts'] : {};

    contexts[name] = { classification: context.classification, upstreams: context.upstreams };
    raw['contexts'] = contexts;
  });
}
