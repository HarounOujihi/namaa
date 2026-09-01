import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExerciseTypeDto {
  @ApiProperty({ example: 'MULTIPLE_CHOICE' })
  @Matches(/^[A-Z][A-Z0-9_]{2,39}$/, { message: 'code must be UPPER_SNAKE_CASE' })
  code!: string;

  @ApiProperty({ example: 'Multiple Choice' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'JSON Schema for this type (draft-07)' })
  @IsObject()
  configSchema!: object;
}

export class UpdateExerciseTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateTypeVersionDto {
  @ApiProperty()
  @IsObject()
  configSchema!: object;
}
