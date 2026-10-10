type Applying<This, Event> = (this: This, event: Event) => Promise<unknown>;

/**
 * A decorator of a method of a projection that receives `Event`, for both decorator modes of
 * the compiler: the standard (TC39) call `(method, context)` and the legacy
 * `experimentalDecorators` call `(prototype, name, descriptor)`. A method that takes another
 * event is refused in both.
 */
export interface ProjectionMethodDecorator<Event> {
  <This extends object>(
    method: Applying<This, Event>,
    context: ClassMethodDecoratorContext<This, Applying<This, Event>>,
  ): void;
  <Method extends (event: Event) => Promise<unknown>>(
    prototype: object,
    name: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
  ): void;
}
