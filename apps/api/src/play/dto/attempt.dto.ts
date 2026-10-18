import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptAnswerDto {
  @ApiProperty({ example: 'answer' })
  @IsString()
  @MaxLength(64)
  questionKey!: string;

  @ApiProperty({ description: "ExerciseAnswer union from exercise-core" })
  @IsObject()
  answer!: object;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  responseTimeMs?: number;
}

export class AttemptEventDto {
  @ApiProperty()
  @IsString()
  clientEventId!: string;

  @ApiProperty({ example: 'GAME_COMPLETED' })
  @IsString()
  @MaxLength(64)
  eventType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eventData?: object;
}

export class SubmitAttemptDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ description: 'Client-generated UUID — makes submission idempotent' })
  @IsString()
  @MinLength(8)
  clientAttemptId!: string;

  @ApiProperty()
  @IsString()
  exerciseVersionId!: string;

  @ApiProperty({ example: '2026-09-01T18:00:00.000Z' })
  @IsDateString()
  startedAt!: string;

  @ApiProperty({ example: '2026-09-01T18:00:30.000Z' })
  @IsDateString()
  completedAt!: string;

  @ApiProperty({ type: 'array' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers!: AttemptAnswerDto[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptEventDto)
  events?: AttemptEventDto[];

  @ApiPropertyOptional({ description: 'Roadmap the exercise was played from (per-roadmap progress)' })
  @IsOptional()
  @IsString()
  roadmapId?: string;
}
