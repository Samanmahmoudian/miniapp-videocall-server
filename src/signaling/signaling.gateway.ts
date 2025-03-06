import { 
  ConnectedSocket, 
  MessageBody, 
  OnGatewayConnection, 
  OnGatewayDisconnect, 
  SubscribeMessage, 
  WebSocketGateway, 
  WebSocketServer 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {Mutex} from 'async-mutex'
let queue: string[] = [];
let mutex = new Mutex()
@WebSocketGateway({ cors: { origin: '*' } })
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private clients = new Map<string, Socket>();

  async handleConnection(client: Socket) {
    const userTelegramId = String(client.handshake.query.userTelegramId);
  
    if (this.clients.has(userTelegramId)) {
      const oldClient = this.clients.get(userTelegramId);
      oldClient?.disconnect(); 
      this.clients.delete(userTelegramId);
    }

    this.clients.set(userTelegramId, client);
  }

  async handleDisconnect(client: Socket) {
    for (let [key, value] of this.clients.entries()) {
      if (value === client) {
        client.broadcast.emit('disconnected', key);
        queue = queue.filter(userId => userId !== key);
        this.clients.delete(key);
        break;
      }
    }
  }

  async startNewCall(TelegramId: string) {
    if (!queue.includes(TelegramId)) { 
      queue.push(TelegramId);
    }
    this.connectClients();
  }

  async connectClients() {
    while (queue.length >= 2) {
      let release = await mutex.acquire()
      const callerId = await queue.shift();
      const calleeId = await queue.shift();
      if(callerId && calleeId){
        const callerClient = this.clients.get(callerId);
        const calleeClient = this.clients.get(calleeId);
        if(calleeClient && callerClient){
          await Promise.all([
            callerClient.emit('caller', calleeId),
            calleeClient.emit('callee', callerId), 
        ]);
        return
        }else{
          release()
          if (callerId) queue.push(callerId);
          if (calleeId) queue.push(calleeId);
          this.connectClients()
        }
      }else{
        release()
        if (callerId) queue.push(callerId);
        if (calleeId) queue.push(calleeId);
        this.connectClients()
      }
    release()
    }
    return
}




  @SubscribeMessage('startNewCall')
  async handleStartNewCall(@MessageBody() telegramId: string, @ConnectedSocket() client: Socket) {
    await this.startNewCall(telegramId);
  }

  @SubscribeMessage('ice')
  async handleIce(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('ice', message.data);
  }

  @SubscribeMessage('offer')
  async handleOffer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('offer', message.data);
  }

  @SubscribeMessage('answer')
  async handleAnswer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('answer', message.data);
  }

  @SubscribeMessage('nextcall')
  async handleNextCall(@MessageBody() Id, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(Id.to);
    target?.emit('nextcall', 'nextcall');

    if(queue.includes(Id.from)){
      queue = queue.filter(userId => userId !== Id.from)
    }
  }
}
