import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { customSchema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { dataSubjectErasedV1 } from '@ddd-ts-kit/kernel';
import {
  InvalidEventDefinitionError,
  createEventRegistry,
  defineIntegrationEvent,
  generateEventCatalog,
  type PersonalPayload,
} from '../src';
import { generateAsyncApi } from '../src/asyncapi';

const customerRegistered = (personal: PersonalPayload) =>
  defineIntegrationEvent({
    type: 'crm.customer.registered',
    version: 1,
    payload: zodSchema(
      z.object({ customerId: z.string(), email: z.email(), address: z.object({ street: z.string() }) }),
    ),
    personal,
  });

describe('defineIntegrationEvent, the personal fields of a payload', () => {
  it('keeps the fields that hold personal data and the field that names whose, nested ones included', () => {
    const definition = customerRegistered({ subject: 'customerId', fields: ['email', 'address.street'] });

    expect(definition.personal).toEqual({ subject: 'customerId', fields: ['email', 'address.street'] });
  });

  it('declares nothing for a payload without personal data', () => {
    expect(createEventRegistry([dataSubjectErasedV1]).all()[0]?.personal).toBeUndefined();
  });

  it.each([
    [{ subject: 'customerId', fields: [] }, 'name no field'],
    [{ subject: 'customerId', fields: ['email', 'email'] }, 'list a field twice'],
    [{ subject: 'email', fields: ['email'] }, 'name their subject "email" as personal data'],
    [{ subject: 'customerId', fields: ['phone'] }, 'name "phone", which the payload does not have'],
    [{ subject: 'personId', fields: ['email'] }, 'name "personId", which the payload does not have'],
  ])('refuses %j: it would %s', (personal, message) => {
    expect(() => customerRegistered(personal)).toThrow(InvalidEventDefinitionError);
    expect(() => customerRegistered(personal)).toThrow(message);
  });

  it('takes the declaration as it is when the schema documents no field: nothing to check it against', () => {
    const opaque = defineIntegrationEvent({
      type: 'crm.customer.imported',
      version: 1,
      payload: customSchema((input) => ({ ok: true, value: input })),
      personal: { subject: 'customerId', fields: ['email'] },
    });

    expect(opaque.personal?.fields).toEqual(['email']);
  });
});

describe('the catalog and AsyncAPI say which fields are personal, and whose', () => {
  const registry = createEventRegistry([customerRegistered({ subject: 'customerId', fields: ['email'] })]);

  it('writes a line under the payload of the version in the catalog', () => {
    expect(generateEventCatalog(registry)).toContain(
      'Personal data: `email`, about the data subject named by `customerId`. A consumer that keeps a copy declares it with `personalFields` and erases it on `privacy.data-subject.erased`.',
    );
  });

  it('takes the erasure event of the kernel as any other definition', () => {
    expect(generateEventCatalog(createEventRegistry([dataSubjectErasedV1]))).toContain(
      '### privacy.data-subject.erased',
    );
  });

  it('extends the message with x-personal-data in AsyncAPI, and leaves the other messages alone', () => {
    const document = generateAsyncApi({
      info: { title: 'Events', version: '1.0.0' },
      registry: createEventRegistry([...registry.all(), dataSubjectErasedV1]),
    });

    expect(document.components.messages['crm.customer.registered.v1']).toMatchObject({
      'x-personal-data': { subject: 'customerId', fields: ['email'] },
    });

    expect(document.components.messages['privacy.data-subject.erased.v1']).not.toHaveProperty('x-personal-data');
  });
});
