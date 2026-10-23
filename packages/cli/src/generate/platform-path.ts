import { type PlatformFile, platformFileIn } from '../platform-layout';
import type { Scope } from './scope';

/** The path of a file of the platform, in its folder or flat as the project keeps it. */
export function platformPath(scope: Scope, file: PlatformFile): string {
  return platformFileIn(scope.config, file, (path) => scope.ws.exists(path));
}
