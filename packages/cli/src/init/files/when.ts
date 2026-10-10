import type { InitFile } from './init-file.js';

export function when(condition: boolean, files: readonly InitFile[]): readonly InitFile[] {
  return condition ? files : [];
}
