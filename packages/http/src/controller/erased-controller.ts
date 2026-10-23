import type { Actor } from '@ddd-ts-kit/kernel';
import type { RouteInput } from '../route/route-input';

/** A controller once its schema types are erased, as the pipeline calls it. */
export interface ErasedController {
  // A method on purpose: its parameter is compared bivariantly, which lets every typed controller in.
  handle(request: RouteInput & { readonly actor: Actor }): unknown;
}
