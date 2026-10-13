import { Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../security/security.module.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Échange une session Supabase (mot de passe + code 2FA vérifiés) contre un jeton API.
  // En-tête : Authorization: Bearer <access token Supabase>.
  @Throttle(RATE_LIMITS.login)
  @Post('session')
  session(@Headers('authorization') authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    return this.authService.createSession(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }
}
