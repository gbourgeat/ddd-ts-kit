import type { StringRecord } from '../scan/string-record';
import { KIT_CONTENT_TYPES, NAMED_ONLY_CONTENT_TYPES } from './kit-content-types';
import type { UploadContentDefect } from './upload-content-defect';
import type { UploadDeclaration } from './upload-declaration';

/** `type/subtype`, or a family `type/*`. */
const MEDIA_TYPE = /^[^/*\s]+\/(?:[^/*\s]+|\*)$/;

/**
 * What `contentRuleDefects` of `@ddd-ts-kit/kernel` refuses when the route is declared, read on the
 * text: an accepted media type no content could prove, and a stated rule that does nothing.
 * `upload-content-defects.spec.ts` holds the two to the same judgement.
 */
export function uploadContentDefects({ mediaTypes, stated }: UploadDeclaration): UploadContentDefect[] {
  const accepted = mediaTypes.map(essenceOf);
  const rules = stated.map(essenceOf);

  return [
    ...mediaTypes.flatMap((literal) => unprovable(literal, rules)),
    ...stated.flatMap((literal) => misstated(literal, accepted)),
  ];
}

function unprovable(literal: StringRecord, rules: readonly string[]): UploadContentDefect[] {
  const essence = essenceOf(literal);

  if (!MEDIA_TYPE.test(essence)) {
    return [{ literal, message: `"${literal.value}" is neither a media type nor a family of them (\`image/*\`).` }];
  }

  const family = `${familyOf(essence)}/`;

  const proven = essence.endsWith('/*')
    ? [...KIT_CONTENT_TYPES, ...rules].some((type) => type.startsWith(family))
    : [...KIT_CONTENT_TYPES, ...rules].some((type) => type === essence || type === familyRuleOf(essence));

  return proven ? [] : [{ literal, message: `"${literal.value}" has no content rule.` }];
}

/** The family whose stated rule holds for a type: none for a type a browser runs, which is stated by name. */
function familyRuleOf(essence: string): string | undefined {
  return NAMED_ONLY_CONTENT_TYPES.includes(essence) ? undefined : `${familyOf(essence)}/*`;
}

function misstated(literal: StringRecord, accepted: readonly string[]): UploadContentDefect[] {
  const essence = essenceOf(literal);

  if (KIT_CONTENT_TYPES.includes(essence)) {
    return [{ literal, message: `\`contentRules\` states "${literal.value}", which the kit already verifies.` }];
  }

  const taken = accepted.includes(essence) || (!essence.endsWith('/*') && accepted.includes(`${familyOf(essence)}/*`));

  return taken
    ? []
    : [
        {
          literal,
          message: `\`contentRules\` states "${literal.value}", which is not one of the accepted media types.`,
        },
      ];
}

/** `Image/PNG; charset=binary` is `image/png`, as `mediaTypeOf` of the kernel reads it. */
function essenceOf({ value }: StringRecord): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase();
}

function familyOf(essence: string): string {
  return essence.split('/')[0] ?? '';
}
