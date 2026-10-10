/** A boundary forgot `ActorContext.run`: a wiring mistake, never a business failure. */
export class NoCurrentActorError extends Error {
  constructor() {
    super('No current actor: the boundary (route, consumer, job) must call ActorContext.run');
    this.name = 'NoCurrentActorError';
  }
}
