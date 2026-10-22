import { WiringError } from '../errors/wiring-error';

/** Calls the method of a projection that applies an event, and answers what it answered. */
export async function applyThrough(projection: object, method: string, event: unknown): Promise<unknown> {
  const apply: unknown = Reflect.get(projection, method);

  if (typeof apply !== 'function') {
    throw new WiringError(
      'INCOMPLETE_BINDING',
      `Projection ${projection.constructor.name} declares that "${method}" applies an event, and has no such method.`,
    );
  }

  const outcome: unknown = await Reflect.apply(apply, projection, [event]);

  return outcome;
}
