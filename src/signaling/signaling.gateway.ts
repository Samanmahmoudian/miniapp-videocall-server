import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Mutex } from 'async-mutex';

let queue: string[] = [];
const mutex = new Mutex();

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
      await this.connectClients();
  }

  async connectClients() {
    const release = await mutex.acquire(); // Acquire the mutex lock

    try {
      while (queue.length > 0 && queue.length % 2 === 0) {
        const caller = this.clients.get(queue[0]);
        const callee = this.clients.get(queue[1]);
        if (caller && callee) {
          caller.emit('caller', queue[1]);
          callee.emit('callee', queue[0]);
          console.log('sent');
        }
        queue.splice(0, 2);
      }
    } finally {
      release(); // Release the mutex lock
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
