import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChildDto {
  @ApiProperty({ example: 'Sami Ahmed' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  /**
   * Kept as a raw ISO string (no @Type(() => Date)): the transform would run
   * before validation and IsDateString would reject the Date object. Prisma
   * accepts ISO-8601 strings for DateTime columns directly.
   */
  @ApiProperty({ example: '2018-04-12', format: 'date' })
  @IsDateString()
  birthDate!: string;

  @ApiPropertyOptional({ example: 'Grade 2' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradeLevel?: string;

  @ApiPropertyOptional({
    description:
      'Optional shared-device profile-picker PIN — not an account credential',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  pin?: string;
}
