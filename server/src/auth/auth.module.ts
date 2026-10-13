import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { SupabaseAuthClient } from './supabase-auth.client.js';

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h') as unknown as number }
  })
});

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), jwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SupabaseAuthClient],
  exports: [AuthService, jwtModule, PassportModule]
})
export class AuthModule {}
