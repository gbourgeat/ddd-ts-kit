import { AspectRuntimeError } from './aspect-runtime-error';

export function missingCollaborator(collaborator: string): never {
  throw new AspectRuntimeError(collaborator);
}
