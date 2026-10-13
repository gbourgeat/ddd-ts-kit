import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Schema } from '@ddd-ts-kit/validation';
import { fieldAccess } from '../field-access/field-access.js';
import type { FieldJudge } from '../field-access/field-judge.js';
import { FieldTree } from '../field-access/field-tree.js';
import type { Route } from '../route/route.js';
import { jsonSchemaOf } from '../schema/json-schema-of.js';
import { SchemaNode } from '../schema/schema-node.js';
import type { FieldLookup } from './field-lookup.js';
import { FormDescriber } from './form-describer.js';
import type { FormDescription } from './form-description.js';
import type { FormHints } from './form-hints.js';
import { assertHints } from './assert-hints.js';

/** The form a route declares, ready to be described for any caller. */
export class FormOfRoute {
  private constructor(
    private readonly route: Route,
    readonly body: SchemaNode,
    private readonly describer: (judge: FieldJudge) => FormDescriber,
  ) {}

  /** Refuses, when the routes are built, a form without a body and hints naming what the body or the routes do not have. */
  static of(route: Route, lookups: ReadonlyMap<string, FieldLookup>): FormOfRoute {
    const schema = route.request?.body;

    if (schema === undefined || route.form === undefined) {
      throw new DeclarationError(`Route "${route.operationId}" declares a form and no request body to describe.`);
    }

    const body = SchemaNode.of(jsonSchemaOf(schema));
    const hints: FormHints = route.form;

    assertHints({ operation: route.operationId, body, hints }, lookups);

    return new FormOfRoute(
      route,
      body,
      (judge) => new FormDescriber(sourceOf(route, { body, schema, hints, lookups }), judge),
    );
  }

  get operation(): string {
    return this.route.operationId;
  }

  async describe(judge: FieldJudge, values: Readonly<Record<string, unknown>>): Promise<FormDescription> {
    const { operationId, method, path } = this.route;

    return {
      type: 'form',
      operation: operationId,
      method,
      path,
      label: operationId,
      blocks: await this.describer(judge).blocks(values),
    };
  }
}

interface Parts {
  readonly body: SchemaNode;
  readonly schema: Schema<unknown>;
  readonly hints: FormHints;
  readonly lookups: ReadonlyMap<string, FieldLookup>;
}

function sourceOf(
  route: Route,
  { body, schema, hints, lookups }: Parts,
): ConstructorParameters<typeof FormDescriber>[0] {
  return { operation: route.operationId, body, fields: FieldTree.of(fieldAccess.of(schema)), hints, lookups };
}
