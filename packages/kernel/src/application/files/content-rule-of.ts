import type { ContentRule } from './content-rule';
import type { ContentRules } from './content-rules';
import { mediaTypeOf } from './media-type-of';
import { SIGNED_MEDIA_TYPES } from './signed-media-types';
import type { StatedContentRule } from './stated-content-rule';
import { TEXT_MEDIA_TYPES } from './text-media-types';

/**
 * The content rule of a media type: the one of the kit when it knows the type (a signature, or
 * text), else the one the route states for it, else for its family. `undefined` when neither says:
 * a content of that type never passes, which `contentRuleDefects` reports before any request.
 */
export function contentRuleOf(mediaType: string, stated: ContentRules = {}): ContentRule | undefined {
  const essence = mediaTypeOf(mediaType);

  return kitRuleOf(essence) ?? statedFor(essence, stated) ?? statedFor(`${essence.split('/')[0] ?? ''}/*`, stated);
}

function kitRuleOf(essence: string): ContentRule | undefined {
  if (SIGNED_MEDIA_TYPES.includes(essence)) {
    return 'signature';
  }

  return TEXT_MEDIA_TYPES.includes(essence) ? 'text' : undefined;
}

function statedFor(essence: string, stated: ContentRules): StatedContentRule | undefined {
  return Object.entries(stated).find(([written]) => mediaTypeOf(written) === essence)?.[1];
}
