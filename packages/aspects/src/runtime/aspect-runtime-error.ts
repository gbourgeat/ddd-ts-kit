/** An aspect needs a collaborator that neither its options nor the runtime provide. */
export class AspectRuntimeError extends Error {
  readonly code = 'ASPECT_RUNTIME_MISSING';

  constructor(
    collaborator: string,
    wayOut = `call installAspectRuntime({ ${collaborator} }) in the composition root, or pass it in the options of the aspect`,
  ) {
    super(`No ${collaborator} for aspects: ${wayOut}`);

    this.name = 'AspectRuntimeError';
  }
}
