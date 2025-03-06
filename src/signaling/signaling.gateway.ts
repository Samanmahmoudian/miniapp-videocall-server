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

let queue: string[] = [];
let usersInCall:string[] = []
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
    console.log(`User connected: ${userTelegramId}`);
  }

  async handleDisconnect(client: Socket) {
    for (let [key, value] of this.clients.entries()) {
      if (value === client) {
        client.broadcast.emit('disconnected', key);
        queue = queue.filter(userId => userId !== key);
        this.clients.delete(key);
        console.log(`User disconnected: ${key}`);
        break;
      }
    }
  }

  async startNewCall(TelegramId: string) {
    if (!queue.includes(TelegramId)) { 
      queue.push(TelegramId);
      if(usersInCall.includes(TelegramId)){
        usersInCall.splice(usersInCall.indexOf(TelegramId) , 1)
      }
    }
    console.log("Current queue:", queue);
    this.connectClients();
  }

  async connectClients() {
    while (queue.length >= 2) {
        const callerId = queue.shift();
        const calleeId = queue.shift();

        if (callerId && calleeId && !usersInCall.includes(calleeId) && !usersInCall.includes(calleeId)) {
            const callerClient = this.clients.get(callerId);
            const calleeClient = this.clients.get(calleeId);

            if (callerClient && calleeClient) {
                await Promise.all([
                    callerClient.emit('caller', calleeId),
                    calleeClient.emit('callee', callerId),
                    usersInCall.push(callerId , calleeId),
                    console.log('incall users: ' , usersInCall)
                ]);
            } else {
                if (callerId) queue.push(callerId);
                if (calleeId) queue.push(calleeId);
            }
        }else{
          this.connectClients()
        }
        
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
