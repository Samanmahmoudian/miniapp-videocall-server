import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';


let queue: string[] = [];


@WebSocketGateway({ cors: { origin: '*' } })
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private clients = new Map();

  async handleConnection(client: Socket) {
    const userTelegramId = String(client.handshake.query.userTelegramId);
      if (this.clients.has(userTelegramId)) {
        this.clients.delete(userTelegramId);
      }
      this.clients.set(userTelegramId, client);
      console.log(userTelegramId);
  }

  async handleDisconnect(client: Socket) {
      for (let [key, value] of this.clients.entries()) {
        if (value === client) {
          client.broadcast.emit('disconnected', key);
          queue = queue.filter(keys => keys !== key);
          this.clients.delete(key);
        }
      }

    console.log(queue);
  }

  async startNewCall(TelegramId: string) {
      if (queue.indexOf(TelegramId) === -1) {
        queue.push(TelegramId);
      }
      console.log(queue);
      this.connectClients();
  }

  async connectClients() {
    while (queue.length >= 2) {
        const callerId = queue.shift();
        const calleeId = queue.shift();
        
        if (this.clients.has(callerId) && this.clients.has(calleeId)) {
            await Promise.all([
                this.clients.get(callerId).emit('caller', calleeId),
                this.clients.get(calleeId).emit('callee', callerId)
            ]);
        } else {
            if (callerId) queue.push(callerId);
            if (calleeId) queue.push(calleeId);
        }
    }
}


  @SubscribeMessage('startNewCall')
  async handleStartNewCall(@MessageBody() telegramId: string, @ConnectedSocket() client: Socket) {
    await this.startNewCall(telegramId);
  }

  @SubscribeMessage('ice')
  async handleIce(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    if (target) {
      target.emit('ice', message.data);
    }
  }

  @SubscribeMessage('offer')
  async handleOffer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    if (target) {
      target.emit('offer', message.data);
    }
  }

  @SubscribeMessage('answer')
  async handleAnswer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    if (target) {
      target.emit('answer', message.data);
    }
  }

  @SubscribeMessage('nextcall')
  async handleNextCall(@MessageBody() Id: string, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(Id);
    if (target) {
      target.emit('nextcall', 'nextcall');
    }
  }
}
