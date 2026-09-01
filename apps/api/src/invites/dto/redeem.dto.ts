import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemDto {
  @ApiProperty({ example: 'A7KD-9M2P', description: 'Invite code from a specialist' })
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, {
    message: 'code must look like XXXX-XXXX',
  })
  code!: string;
}
