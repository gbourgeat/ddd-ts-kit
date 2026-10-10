import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';

export class ReadMedicalFileQuery extends AuthorizedQuery<string> {
  constructor(
    actor: Actor,
    readonly patientId: string,
  ) {
    super(actor);
  }
}
