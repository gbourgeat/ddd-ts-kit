import { AspectRuntimeError } from './aspect-runtime-error.js';

export function missingCollaborator(collaborator: string): never {
  throw new AspectRuntimeError(collaborator);
}
