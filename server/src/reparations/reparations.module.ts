import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReparationsController } from './reparations.controller.js';
import { ReparationsService } from './reparations.service.js';
import { ReparationsGateway } from './reparations.gateway.js';

@Module({
  imports: [AuthModule],
  controllers: [ReparationsController],
  providers: [ReparationsService, ReparationsGateway]
})
export class ReparationsModule {}
