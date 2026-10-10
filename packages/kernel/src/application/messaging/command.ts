import type { KIND, RESULT } from './message-brands.js';

/** An intention to change state. `R` is what the handler answers: nothing or an identifier. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- R is a phantom type: it only exists so that ResultOf<C> can infer what the handler answers
export abstract class Command<R = void> {
  declare readonly [RESULT]?: R;

  declare readonly [KIND]?: 'command';
}
