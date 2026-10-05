import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BoutiquesController } from './boutiques.controller.js';
import { BoutiquesService } from './boutiques.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BoutiquesController],
  providers: [BoutiquesService]
})
export class BoutiquesModule {}
