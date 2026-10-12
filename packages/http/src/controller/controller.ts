import { DeclarationError, Edge, type ClassDeclarator } from '@ddd-ts-kit/kernel/declarations';
import type { ControllerSpec } from './controller-spec.js';
import { declaredRoute } from './declared-route.js';
import type { HttpController } from './http-controller.js';
import { presentationRegistry } from './presentation-registry.js';

/**
 * Declares one route on the class that answers it:
 *
 *     @Controller({ group: AppointmentRoutes, method: 'POST', path: '/', summary: 'Book appointment',
 *       body, response: { status: 201, body: accepted }, errors: ['SLOT_TAKEN'] })
 *     export class BookAppointmentController {
 *       constructor(private readonly commands: CommandBus) {}
 *       async handle({ body, actor }: HttpRequest<{ body: BookAppointmentBody }>): Promise<BookAppointmentAccepted> { ... }
 *     }
 *
 * The declaration is the single statement of the route: the server validates with its schemas
 * and the contract is generated from it. The compiler holds `handle` to it: a part the
 * schemas do not produce, or another body than the declared response, is refused on the
 * decorator. The constructor states the dependencies, as for every declared class.
 */
export function Controller<const Spec extends ControllerSpec>(
  spec: Spec,
): ClassDeclarator<HttpController<Spec>, undefined> {
  const declare = Edge<HttpController<Spec>>('controller');

  return (target, context) => {
    if (!target.name.endsWith('Controller')) {
      throw new DeclarationError(
        `${target.name} carries @Controller: name the class after its use case, ending in Controller.`,
      );
    }

    declaredRoute(target.name, spec);
    declare(target, context);
    presentationRegistry().controllers.set(target, spec);
  };
}
