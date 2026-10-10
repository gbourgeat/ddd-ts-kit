type AsyncMethod<This, Args extends unknown[], Result> = (this: This, ...args: Args) => Promise<Result>;

/**
 * A decorator of a public instance method that answers a promise, for both decorator modes of
 * the compiler: the standard (TC39) call `(method, context)` and the legacy
 * `experimentalDecorators` call `(prototype, name, descriptor)`. Several on one method nest as
 * they read: the one written first is outermost.
 */
export interface AsyncMethodDecorator {
  <This extends object, Args extends unknown[], Result>(target: AsyncMethod<This, Args, Result>, context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Result>>): void;
  <Method extends (...args: never[]) => Promise<unknown>>(prototype: object, name: string | symbol, descriptor: TypedPropertyDescriptor<Method>): TypedPropertyDescriptor<Method> | undefined;
}
