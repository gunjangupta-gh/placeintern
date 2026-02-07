import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../core/auth/auth.module';
import { UnifiedWebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Global()
@Module({
  imports: [ConfigModule, AuthModule],
  providers: [UnifiedWebSocketGateway, WebSocketService],
  exports: [WebSocketService, UnifiedWebSocketGateway],
})
export class WebSocketModule {}
