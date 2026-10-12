import type { CommandBus, IntegrationEvent } from '../../../../../../../../src/index.js';
import { IntegrationEventHandler } from '../../../../../../../../src/declarations.js';
import { PatientRegistered, type PatientRegisteredPayload } from '../../../published-language/patient-registered.js';
import { RequestCallback } from '../../commands/request-callback/request-callback.command.js';

@IntegrationEventHandler(PatientRegistered, { consumer: 'clinic.welcome-on-patient-registered' })
export class WelcomeOnPatientRegistered implements IntegrationEventHandler<PatientRegisteredPayload> {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<PatientRegisteredPayload>): Promise<void> => {
    await this.commands.execute(new RequestCallback(`welcome ${event.payload.patientId}`));
  };
}
