import type { InitFile } from './init-file';

export function when(condition: boolean, files: readonly InitFile[]): readonly InitFile[] {
  return condition ? files : [];
}
