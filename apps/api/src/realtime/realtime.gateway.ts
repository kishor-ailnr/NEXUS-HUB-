import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, { userId: string; orgId: string }>();

  constructor(private readonly supabaseService: SupabaseService) {}

  afterInit() {
    this.logger.log('Realtime WebSocket Gateway initialized on namespace /realtime');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract access token from cookies or auth header/query
      let token: string | undefined;
      const cookieHeader = client.handshake.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((res: Record<string, string>, item) => {
          const [name, value] = item.trim().split('=');
          if (name && value) res[name] = decodeURIComponent(value);
          return res;
        }, {});
        token = cookies['nw_access'];
      }

      if (!token && client.handshake.auth?.token) {
        token = client.handshake.auth.token;
      }
      if (!token && client.handshake.query?.token) {
        token = client.handshake.query.token as string;
      }

      if (!token) {
        this.logger.debug(`Realtime connection rejected: no token provided (${client.id})`);
        client.disconnect();
        return;
      }

      const decoded = await this.supabaseService.verifyJwt(token);
      const userId = decoded.sub || decoded.id;
      let orgId = decoded.orgId || decoded.org_id;

      if (!orgId && userId) {
        const { data: userRow } = await this.supabaseService.adminClient
          .from('users')
          .select('org_id')
          .eq('id', userId)
          .maybeSingle();
        if (userRow?.org_id) {
          orgId = userRow.org_id;
        }
      }

      if (!userId || !orgId) {
        this.logger.debug(`Realtime connection rejected: missing user/org context in token (${client.id})`);
        client.disconnect();
        return;
      }

      // Join organization room
      const room = `org:${orgId}`;
      client.join(room);
      this.connectedClients.set(client.id, { userId, orgId });

      this.logger.log(`Client ${client.id} (user: ${userId}) joined realtime room ${room}`);
      client.emit('connected', { status: 'ok', orgId });
    } catch (err: any) {
      this.logger.warn(`Realtime connection authentication failed (${client.id}): ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  broadcastToOrg(orgId: string, event: string, payload: any): void {
    if (this.server) {
      this.server.to(`org:${orgId}`).emit(event, payload);
    }
  }

  getConnectionCount(): number {
    return this.connectedClients.size;
  }

  isHealthy(): boolean {
    return !!this.server;
  }
}
