import { AspectRuntimeError } from './aspect-runtime-error';

export function missingCollaborator(collaborator: string, wayOut?: string): never {
  throw new AspectRuntimeError(collaborator, wayOut);
}
