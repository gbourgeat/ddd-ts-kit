import { contentRuleDefects } from '@ddd-ts-kit/kernel';
import type { UploadSpec } from './upload-spec';

/**
 * Why a declared upload could receive no file, one sentence per defect: a media type no content
 * could prove, a stated content rule that does nothing. Empty for a route without an upload.
 */
export function uploadDefects(upload: UploadSpec | undefined): string[] {
  return upload === undefined
    ? []
    : contentRuleDefects({ accepted: upload.mediaTypes, contentRules: upload.contentRules ?? {} });
}
