import { NOISE_PATHS } from './noise-paths.js';

/** Whether the path, without its query string, is one of the noise paths or below one of them. */
export function isNoisePath(url: string, paths: readonly string[] = NOISE_PATHS): boolean {
  const path = url.split('?', 1).join('');

  return paths.some((noise) => path === noise || path.startsWith(`${noise}/`));
}
