import { IsInt, IsString } from 'class-validator';

/** Where the document can be fetched, until when, and what will be found there. */
export class GetAppointmentDocumentAnswer {
  /** A link that grants this file alone, for five minutes, as an attachment. */
  @IsString()
  url = '';

  @IsString()
  expiresAt = '';

  @IsString()
  name = '';

  @IsString()
  mediaType = '';

  @IsInt()
  size = 0;
}
