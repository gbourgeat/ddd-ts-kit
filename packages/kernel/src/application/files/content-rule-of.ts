import type { ContentRule } from './content-rule';
import type { ContentRules } from './content-rules';
import { mediaTypeOf } from './media-type-of';
import { NAMED_ONLY_MEDIA_TYPES } from './named-only-media-types';
import { SIGNED_MEDIA_TYPES } from './signed-media-types';
import type { StatedContentRule } from './stated-content-rule';
import { TEXT_MEDIA_TYPES } from './text-media-types';

/**
 * The content rule of a media type: the one of the kit when it knows the type (a signature, or
 * text), else the one the route states for it, else for its family. `undefined` when neither says:
 * a content of that type never passes, which `contentRuleDefects` reports before any request.
 * The rule of a family never reaches a type a browser runs (`NAMED_ONLY_MEDIA_TYPES`: SVG, HTML,
 * JavaScript): the route states that one by its name, or does not take it.
 */
export function contentRuleOf(mediaType: string, stated: ContentRules = {}): ContentRule | undefined {
  const essence = mediaTypeOf(mediaType);

  return kitRuleOf(essence) ?? statedFor(essence, stated) ?? statedForFamilyOf(essence, stated);
}

function kitRuleOf(essence: string): ContentRule | undefined {
  if (SIGNED_MEDIA_TYPES.includes(essence)) {
    return 'signature';
  }

  return TEXT_MEDIA_TYPES.includes(essence) ? 'text' : undefined;
}

function statedForFamilyOf(essence: string, stated: ContentRules): StatedContentRule | undefined {
  return NAMED_ONLY_MEDIA_TYPES.includes(essence) ? undefined : statedFor(`${essence.split('/')[0] ?? ''}/*`, stated);
}

function statedFor(essence: string, stated: ContentRules): StatedContentRule | undefined {
  return Object.entries(stated).find(([written]) => mediaTypeOf(written) === essence)?.[1];
}
