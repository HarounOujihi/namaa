import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExerciseDto {
  @ApiProperty({ example: 'هل الصوتان متشابهان؟' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiProperty()
  @IsString()
  skillId!: string;

  @ApiProperty()
  @IsString()
  difficultyLevelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageGroupId?: string;

  @ApiProperty({ description: 'Exercise type version this content conforms to' })
  @IsString()
  exerciseTypeVersionId!: string;

  @ApiProperty()
  @IsObject()
  configuration!: object;
}

export class UpdateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficultyLevelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageGroupId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configuration?: object;
}

export class StageItemCreateDto {
  @ApiProperty()
  @IsString()
  exerciseId!: string;
}

export class StageItemOrderDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;
}

export class StagePatchDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  masteryThreshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minAccuracy?: number | null;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSuccessfulAttempts?: number | null;
}

export class AssetTypeFilter {
  @ApiPropertyOptional({ enum: ['IMAGE', 'AUDIO', 'VIDEO', 'ANIMATION', 'GAME_ASSET'] })
  @IsOptional()
  @IsEnum(['IMAGE', 'AUDIO', 'VIDEO', 'ANIMATION', 'GAME_ASSET'])
  type?: string;
}

export class ExerciseListFilter {
  @ApiPropertyOptional({ enum: ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  skillId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Include configSchema of latest type version' })
  @IsOptional()
  @IsArray()
  includeSchemas?: string[];
}
