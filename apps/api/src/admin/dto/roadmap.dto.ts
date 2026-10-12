import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoadmapDto {
  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  order?: number;
}

export class UpdateRoadmapDto {
  @ApiPropertyOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @ApiPropertyOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsInt()
  order?: number;
}
