import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy.js';

// Remplace tech-tasks-channel (Supabase Realtime, web/mobile) : même comportement,
// une seule notification "nouvelle réparation assignée" par ticket créé, envoyée
// uniquement au technicien concerné (room technicien:{id}).
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' } })
export class ReparationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ReparationsGateway.name);

  constructor(private jwt: JwtService) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      client.join(`technicien:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong' };
  }

  notifyRepairAssigned(idTechnicien: number, repair: unknown) {
    this.server.to(`technicien:${idTechnicien}`).emit('repair:assigned', repair);
    this.logger.debug(`repair:assigned émis vers technicien:${idTechnicien}`);
  }
}
