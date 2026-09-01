import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateChildDto } from './create-child.dto';

export class UpdateChildDto extends PartialType(CreateChildDto) {
  @ApiPropertyOptional({ description: 'Asset ID of a previously uploaded image' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  avatarAssetId?: string;
}
