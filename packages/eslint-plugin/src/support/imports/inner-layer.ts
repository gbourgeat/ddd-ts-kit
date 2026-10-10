import type { LintedFile } from '../../project/linted-file.js';

/** `domain` or `application` for a production file of one of the two layers that hold the model and the use cases. */
export function innerLayer(file: LintedFile): 'domain' | 'application' | undefined {
  if (file.location.area !== 'context' || file.isTest) return undefined;

  const { layer } = file.location;

  return layer === 'domain' || layer === 'application' ? layer : undefined;
}
