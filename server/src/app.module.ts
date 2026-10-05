import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ReparationsModule } from './reparations/reparations.module.js';
import { BoutiquesModule } from './boutiques/boutiques.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ReparationsModule, BoutiquesModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
