import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto } from '@/dtos';
import { ILoginResult } from '@/interfaces';
import { AuthService } from '@/services';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate a reviewer',
    description:
      'Simulated login. Returns a JWT carrying the reviewer id and locale, used to scope all subsequent requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated; returns an access token.',
  })
  login(@Body() dto: LoginDto): Promise<ILoginResult> {
    return this.authService.login(dto.reviewerId, dto.locale);
  }
}
