import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Updates: `undefined` = leave unchanged; `null` is only accepted by the
// clearable fields (description, categoryId, coverAssetId).
const present = (_: object, value: unknown) => value !== undefined;

export class CreateRoadmapDto {
  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'IMAGE asset id' })
  @IsOptional() @IsString()
  coverAssetId?: string;
}

export class UpdateRoadmapDto {
  @ApiPropertyOptional()
  @ValidateIf(present) @Transform(trim) @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf(present) @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(present) @IsInt()
  order?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'IMAGE asset id' })
  @IsOptional() @IsString()
  coverAssetId?: string | null;
}

export class CreateRoadmapCategoryDto {
  @ApiProperty()
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ description: 'IMAGE asset id' })
  @IsOptional() @IsString()
  coverAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  order?: number;
}

export class UpdateRoadmapCategoryDto {
  @ApiPropertyOptional()
  @ValidateIf(present) @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'IMAGE asset id' })
  @IsOptional() @IsString()
  coverAssetId?: string | null;

  @ApiPropertyOptional()
  @ValidateIf(present) @IsInt()
  order?: number;
}
