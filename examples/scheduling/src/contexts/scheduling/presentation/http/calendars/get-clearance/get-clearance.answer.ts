import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetClearanceAnswer {
  @IsString()
  clearanceId = '';

  /** The status of its job: `waiting`, `running`, `succeeded`, `cancelled` or `dead` (every attempt failed). */
  @IsString()
  status = '';

  @IsInt()
  @Min(0)
  attempts = 0;

  /** Appointments handled so far. */
  @IsInt()
  @Min(0)
  done = 0;

  /** Appointments to handle in all; absent until the first attempt started. */
  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsString()
  lastErrorCode?: string;
}
