import { QueuedJobStatus } from '@ddd-ts-kit/kernel';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetClearanceAnswer {
  @IsString()
  declare clearanceId: string;

  /** The status of its job; `dead` when every attempt failed. */
  @IsIn(Object.values(QueuedJobStatus))
  declare status: string;

  @IsInt()
  @Min(0)
  declare attempts: number;

  /** Appointments handled so far. */
  @IsInt()
  @Min(0)
  declare done: number;

  /** Appointments to handle in all; absent until the first attempt started. */
  @IsOptional()
  @IsInt()
  @Min(0)
  declare total?: number;

  @IsOptional()
  @IsString()
  declare lastErrorCode?: string;
}
