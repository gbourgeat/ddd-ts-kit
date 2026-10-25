import type { Schema } from '@ddd-ts-kit/validation';
import type { DtoType } from './dto-type';
import type { NestControllerClass } from './nest-controller-class';
import { nestRoutesRegistry } from './nest-routes-registry';

/**
 * Says what each method of a Nest controller answers, as `ddd-ts-kit` reads it from its signature
 * (`Promise<IssuedInvoice>`): a DTO class, a schema, or `null` for no body. The generated
 * `<context>.controllers.ts` calls it, and `response.body` of `@KitRoute` still wins.
 */
export function withAnswers<Controller extends NestControllerClass>(
  controller: Controller,
  answers: Readonly<Record<string, Schema<unknown> | DtoType | null>>,
): Controller {
  nestRoutesRegistry().answers.set(controller, new Map(Object.entries(answers)));

  return controller;
}
