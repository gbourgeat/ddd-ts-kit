import type { NestControllerClass } from './nest-controller-class';
import { nestRoutesRegistry } from './nest-routes-registry';
import type { NestSignature } from './nest-signature';

/**
 * Says what the signature of each method of a Nest controller says, as `ddd-ts-kit` reads it from
 * its source: the DTO classes of the parts of the request, and the answer. The generated
 * `<context>.controllers.ts` calls it, so that neither `@KitRoute` nor `emitDecoratorMetadata` has
 * to say it again; `request` and `response.body` of `@KitRoute` still win.
 */
export function withSignatures<Controller extends NestControllerClass>(
  controller: Controller,
  signatures: Readonly<Record<string, NestSignature>>,
): Controller {
  nestRoutesRegistry().signatures.set(controller, new Map(Object.entries(signatures)));

  return controller;
}
