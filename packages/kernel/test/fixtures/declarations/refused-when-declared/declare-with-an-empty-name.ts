import { IntegrationEventHandler, Policy } from '../../../../src/declarations';
import { scheduleVisits } from '../contexts/clinic/application/authorization/clinic.permissions';
import { PatientRegistered } from '../contexts/clinic/published-language/patient-registered';

/** A name read from somewhere else, blank: the types refuse the empty literal, the decorator the empty text. */
const blank: string = ''.trim();

export function declareAHandlerWithoutConsumerName(): void {
  IntegrationEventHandler(PatientRegistered, { consumer: blank });
}

export function declareAPolicyWithoutName(): void {
  Policy(scheduleVisits, { name: blank });
}
