import { acceptsMediaType } from './accepts-media-type';
import type { ContentExpectation } from './content-expectation';
import { contentRuleOf } from './content-rule-of';
import type { ContentRules } from './content-rules';
import { mediaTypeOf } from './media-type-of';
import { SIGNED_MEDIA_TYPES } from './signed-media-types';
import { TEXT_MEDIA_TYPES } from './text-media-types';

/** `type/subtype`, or a family `type/*`. */
const MEDIA_TYPE = /^[^/*\s]+\/(?:[^/*\s]+|\*)$/;

const STATE_ONE =
  "State one in `contentRules`: 'text' (held to the text rule) or 'unchecked' (the bytes are taken as they are).";

/**
 * What is wrong with the media types an upload accepts, one sentence each, before any request: an
 * accepted type no content could ever prove (no signature, no text rule, none stated), and a stated
 * rule that does nothing (for a type the kit already verifies, or one not accepted). Empty when
 * every accepted type has a content rule: whoever declares the upload refuses to start otherwise.
 */
export function contentRuleDefects(expectation: Pick<ContentExpectation, 'accepted' | 'contentRules'>): string[] {
  const { accepted, contentRules = {} } = expectation;

  return [
    ...accepted.flatMap((entry) => unprovable(entry, contentRules)),
    ...Object.keys(contentRules).flatMap((written) => misstated(written, accepted)),
  ];
}

function unprovable(entry: string, stated: ContentRules): string[] {
  const essence = mediaTypeOf(entry);

  if (!MEDIA_TYPE.test(essence)) {
    return [`"${entry}" is neither a media type nor a family of them (\`image/*\`): no file is ever of it.`];
  }

  const proven = essence.endsWith('/*') ? familyHasRule(essence, stated) : contentRuleOf(essence, stated) !== undefined;

  return proven
    ? []
    : [
        `"${entry}" has no content rule: the kit knows neither a signature nor a text rule for it, so no file of that type ever passes. ${STATE_ONE}`,
      ];
}

/** A family is provable when one type of it is: one the kit knows, or one a stated rule names, the family itself included. */
function familyHasRule(family: string, stated: ContentRules): boolean {
  const prefix = family.slice(0, -1);
  const known = [...SIGNED_MEDIA_TYPES, ...TEXT_MEDIA_TYPES, ...Object.keys(stated).map(mediaTypeOf)];

  return known.some((type) => type.startsWith(prefix));
}

function misstated(written: string, accepted: readonly string[]): string[] {
  const essence = mediaTypeOf(written);
  const ofTheKit = contentRuleOf(essence);

  if (ofTheKit !== undefined) {
    return [
      `\`contentRules\` states "${written}", which the kit already verifies (${ofTheKit}): a stated rule does not replace it. Remove it.`,
    ];
  }

  const taken = essence.endsWith('/*')
    ? accepted.map(mediaTypeOf).includes(essence)
    : acceptsMediaType(accepted, essence);

  return taken
    ? []
    : [
        `\`contentRules\` states "${written}", which is not one of the accepted media types: add it there, or remove it.`,
      ];
}
