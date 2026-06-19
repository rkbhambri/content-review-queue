import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { Locale } from '@/enums';

export class LoginDto {
  @ApiProperty({
    example: 'reviewer-1',
    description: 'Human-friendly reviewer identifier.',
  })
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'reviewerId may only contain letters, numbers, hyphens and underscores',
  })
  reviewerId: string;

  @ApiProperty({
    enum: Locale,
    example: Locale.WEST_COAST,
    description:
      'Locale the reviewer is assigned to. Scopes everything they can see/claim.',
  })
  @IsEnum(Locale)
  locale: Locale;
}
