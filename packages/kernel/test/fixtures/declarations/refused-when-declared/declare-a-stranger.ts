import { Public } from '../../../../src/declarations.js';

export function declareAStranger(): void {
  const decorate = Public();

  class Stranger {}

  Reflect.apply(decorate, undefined, [Stranger, undefined]);
}
