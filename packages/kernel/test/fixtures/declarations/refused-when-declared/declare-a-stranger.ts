import { Public } from '../../../../src/declarations';

export function declareAStranger(): void {
  const decorate = Public();

  class Stranger {}

  Reflect.apply(decorate, undefined, [Stranger, undefined]);
}
