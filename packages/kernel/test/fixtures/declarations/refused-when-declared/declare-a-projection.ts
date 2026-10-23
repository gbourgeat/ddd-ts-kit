import type { IntegrationEvent } from '../../../../src';
import { On, Projection } from '../../../../src/declarations';
import {
  PatientRegistered,
  type PatientRegisteredPayload,
} from '../contexts/clinic/published-language/patient-registered';

export function declareAProjectionOfNothing(): void {
  @Projection('clinic.of-nothing')
  class OfNothing {}

  void OfNothing;
}

export function declareAProjection(name: `${string}.${string}`): void {
  Projection(name);
}

/** `@On` on a class that never says it is a projection: the next projection finds it and refuses. */
export function declareAnOnWithoutItsProjection(): void {
  class Forgotten {
    @On(PatientRegistered)
    async registered(_event: IntegrationEvent<PatientRegisteredPayload>): Promise<void> {}
  }

  @Projection('clinic.after-the-forgotten')
  class AfterTheForgotten {
    @On(PatientRegistered)
    async applied(_event: IntegrationEvent<PatientRegisteredPayload>): Promise<void> {}
  }

  void Forgotten;
  void AfterTheForgotten;
}
