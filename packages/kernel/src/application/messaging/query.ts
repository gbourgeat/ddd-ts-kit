import type { KIND, RESULT } from './message-brands';

/** A question. Answering it never changes state. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- R is a phantom type: it only exists so that ResultOf<Q> can infer what the handler answers
export abstract class Query<R> {
  declare readonly [RESULT]?: R;

  declare readonly [KIND]?: 'query';
}
