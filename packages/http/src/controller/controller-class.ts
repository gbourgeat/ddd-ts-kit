/**
 * A class given as a controller. Any class is accepted by the types, so that the classes an
 * application lists as declared controllers are handed over as they are; one that carries no
 * `@Controller` is refused when the routes are built.
 */
export type ControllerClass = abstract new (...args: never) => unknown;
