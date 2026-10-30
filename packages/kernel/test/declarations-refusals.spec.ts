import { describe, expect, it } from 'vitest';
import * as clinic from './fixtures/declarations/declared-clinic';

describe('a declaration refused where it is written', () => {
  it('a projection fed by the event store may not apply an integration event: those reach it where they are consumed', () => {
    expect(() => clinic.declareAProjectionFedByTheStoreOfAnIntegrationEvent()).toThrow(
      /Projection FedByTheStore is fed by the event store and applies the integration event of its method "registered"/,
    );
  });

  it('a handler of an integration event and a policy need a name that is not blank', () => {
    expect(() => clinic.declareAHandlerWithoutConsumerName()).toThrow(
      /An integration event handler needs a consumer name, and it is empty/,
    );

    expect(() => clinic.declareAPolicyWithoutName()).toThrow(
      /A policy of clinic:visit.schedule needs a name, and it is empty/,
    );
  });
});
