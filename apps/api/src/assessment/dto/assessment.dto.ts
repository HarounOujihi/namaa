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

export class CreateAssessmentDto {
  @ApiProperty({ example: 'الاختبار التشخيصي' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class CreateAssessmentItemDto {
  @ApiProperty()
  @IsString()
  assessmentVersionId!: string;

  @ApiProperty()
  @IsString()
  skillId!: string;

  @ApiProperty({ description: 'Exercise type version this item renders as' })
  @IsString()
  exerciseTypeVersionId!: string;

  @ApiProperty()
  @IsObject()
  configuration!: object;
}

export class UpdateAssessmentItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configuration?: object;
}

export class AssessmentAnswerDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ description: "ExerciseAnswer union from exercise-core" })
  @IsObject()
  answer!: object;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  responseTimeMs?: number;
}

export class SubmitAssessmentDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ description: 'Client UUID — makes submission idempotent' })
  @IsString()
  @MinLength(8)
  clientAttemptId!: string;

  @ApiProperty()
  @IsString()
  assessmentVersionId!: string;

  @ApiProperty({ example: '2026-09-02T10:00:00.000Z' })
  @IsDateString()
  startedAt!: string;

  @ApiProperty({ example: '2026-09-02T10:03:00.000Z' })
  @IsDateString()
  completedAt!: string;

  @ApiProperty({ type: 'array' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers!: AssessmentAnswerDto[];
}
