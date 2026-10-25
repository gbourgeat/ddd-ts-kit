import { PATH_METADATA } from '@nestjs/common/constants';
import type { NestControllerClass } from './nest-controller-class';
import { reflectedMetadata } from './reflected-metadata';

/** Whether Nest's `@Controller` was written on the class. */
export function isNestController(controller: NestControllerClass): boolean {
  return reflectedMetadata(PATH_METADATA, controller) !== undefined;
}
