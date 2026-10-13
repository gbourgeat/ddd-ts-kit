import { systemActor } from '@ddd-ts-kit/kernel';
import { FieldJudge } from '../field-access/field-judge.js';
import type { Route } from '../route/route.js';
import type { FormDocument } from './form-document.js';
import { FormOfRoute } from './form-of-route.js';
import { jsonFormsOf } from './json-forms-of.js';
import { lookupsOf } from './lookups-of.js';

/**
 * Every form of the routes, whole, in both formats, sorted by operation: what a contract script
 * writes next to the OpenAPI document (`openapi/forms/<operationId>.json`), so that a front end
 * team reads the forms where it reads the API. What a caller may not see is said by
 * `x-field-access` in the contract, not here.
 */
export async function formDocumentsOf(routes: readonly Route[]): Promise<FormDocument[]> {
  const lookups = lookupsOf(routes);
  const everything = new FieldJudge(systemActor('documentation'), () => Promise.resolve(true));
  const forms = routes.filter((route) => route.form !== undefined).map((route) => FormOfRoute.of(route, lookups));

  const documents = await Promise.all(
    forms.map(async (form) => {
      const blocks = await form.describe(everything, {});

      return { operation: form.operation, jsonForms: jsonFormsOf(blocks, form.body, {}), blocks };
    }),
  );

  return documents.sort((a, b) => (a.operation < b.operation ? -1 : a.operation > b.operation ? 1 : 0));
}
