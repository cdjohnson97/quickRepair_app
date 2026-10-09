import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReparationsController } from './reparations.controller.js';
import { ReparationsService } from './reparations.service.js';
import { ReparationsGateway } from './reparations.gateway.js';
import { PushService } from '../notifications/push.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReparationsController],
  providers: [ReparationsService, ReparationsGateway, PushService]
})
export class ReparationsModule {}
