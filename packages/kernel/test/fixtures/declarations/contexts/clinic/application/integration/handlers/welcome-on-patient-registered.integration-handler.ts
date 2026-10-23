import type { CommandBus, IntegrationEvent } from '../../../../../../../../src';
import { IntegrationEventHandler } from '../../../../../../../../src/declarations';
import { PatientRegistered, type PatientRegisteredPayload } from '../../../published-language/patient-registered';
import { RequestCallback } from '../../commands/request-callback/request-callback.command';

@IntegrationEventHandler(PatientRegistered, { consumer: 'clinic.welcome-on-patient-registered' })
export class WelcomeOnPatientRegistered implements IntegrationEventHandler<PatientRegisteredPayload> {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<PatientRegisteredPayload>): Promise<void> => {
    await this.commands.execute(new RequestCallback(`welcome ${event.payload.patientId}`));
  };
}
